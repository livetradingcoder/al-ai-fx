import { createHmac, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Outbound webhooks: tell an external URL (e.g. a WhatsApp relay) when something
// happens here. Endpoints and the delivery log live in the admin under Webhooks.
//
// Each delivery is one POST of a JSON body, signed with the endpoint's secret:
//   X-Webhook-Signature  HMAC-SHA256 of the exact body, hex (or sha256=<hex>)
//   X-Hub-Signature-256  the same, always sha256=<hex>
//   X-Webhook-Id / -Event / -Timestamp  informational, not signed
// A 2xx is success. Anything else is retried (3 attempts, a few seconds apart)
// and, if it still fails, stays FAILED in the log until someone redelivers it.
// Nothing here may ever throw into the request that caused the event: a webhook
// problem must not be able to fail a sale.

export const WEBHOOK_EVENTS = {
  "user.signup": "A new account was created",
  "trial.started": "A free trial was started",
  "sale.completed": "An order was paid (or a free order was placed)",
  "webhook.test": "Sent from the admin to check the connection",
} as const;
export type WebhookEventType = keyof typeof WEBHOOK_EVENTS;
export const SELECTABLE_EVENTS = ["user.signup", "trial.started", "sale.completed"] as const;

export const SIGNATURE_FORMATS = ["hex", "prefixed"] as const;
export type SignatureFormat = (typeof SIGNATURE_FORMATS)[number];

const ATTEMPT_DELAYS_MS = [0, 3000, 12000];
const REQUEST_TIMEOUT_MS = 10_000;
const KEEP_RESPONSE_CHARS = 1000;
const RETENTION_DAYS = 30;

const SITE = "AL-AI-FX";
const siteUrl = () => (process.env.NEXTAUTH_URL || "https://www.al-ai-fx.xyz").replace(/\/$/, "");

// ── Signing ─────────────────────────────────────────────────────────────────

export function signBody(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function signatureHeaders(secret: string, body: string, format: string): Record<string, string> {
  const hex = signBody(secret, body);
  return {
    "X-Webhook-Signature": format === "prefixed" ? `sha256=${hex}` : hex,
    "X-Hub-Signature-256": `sha256=${hex}`,
  };
}

// ── URL safety (the server fetches whatever an admin types) ─────────────────

function ipv4Private(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, incl. cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return ipv4Private(ip);
  if (kind === 6) {
    const v = ip.toLowerCase();
    if (v === "::" || v === "::1") return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return ipv4Private(mapped[1]);
    return v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb");
  }
  return false;
}

/**
 * https only, and never a private, loopback or link-local address: an endpoint is
 * an arbitrary URL the server will call. Resolved names are checked too, and again
 * on every send, so a name that later points inward is refused.
 */
export async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("That is not a valid URL");
  }
  if (url.protocol !== "https:") throw new Error("The URL must start with https://");
  if (url.username || url.password) throw new Error("Put credentials in the secret, not in the URL");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("That address is not reachable from the internet");
  }
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new Error("That address is not reachable from the internet");
    return url;
  }
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new Error(`Could not find ${host} — check the URL`);
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error("That address is not reachable from the internet");
  }
  return url;
}

// ── Event payloads ──────────────────────────────────────────────────────────

export type SaleEventData = {
  orderId: string | null;
  orderRef: string;
  provider: string;
  amount: number;
  currency: string;
  tier: string;
  robotSlug: string;
  robotName: string;
  email: string;
  userId: string;
  refCode: string | null;
  /** The buyer's account was created by this order, so there is no separate signup event. */
  newCustomer?: boolean;
};
export type SignupEventData = { userId: string; email: string; name: string | null; source: "purchase" | "trial" };
/** `newAccount`: this trial also created the account, so it is one event, not a signup followed by a trial. */
export type TrialEventData = { userId: string; email: string; robotSlug: string; robotName: string; newAccount?: boolean };

export type EventData =
  | { type: "sale.completed"; data: SaleEventData }
  | { type: "user.signup"; data: SignupEventData }
  | { type: "trial.started"; data: TrialEventData }
  | { type: "webhook.test"; data: { webhookName: string } };

/** Where a paid order came from, from the prefix on its external id. */
export function providerOf(orderRef: string): string {
  if (orderRef.startsWith("POLAR-")) return "Polar";
  if (orderRef.startsWith("OXAPAY-")) return "OxaPay";
  if (orderRef.startsWith("WHOP-")) return "Whop";
  if (orderRef.startsWith("COUPON-")) return "Coupon";
  if (orderRef.startsWith("TEST-")) return "Test";
  return "Paygate";
}

const tierLabel = (tier: string) =>
  tier
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const money = (amount: number, currency: string) =>
  `${currency.toUpperCase() === "USD" ? "$" : ""}${amount.toFixed(2)}${currency.toUpperCase() === "USD" ? "" : ` ${currency.toUpperCase()}`}`;

/**
 * The body every endpoint receives. `message` is a finished, human-readable text
 * (what a chat relay should show); `data` is the same thing structured, for
 * anything that wants to do more than forward it. `path` is relative to the site
 * so a receiver with its own base URL can build a deep link; `url` is absolute.
 */
export function buildEventBody(event: EventData, id: string = randomUUID(), now: Date = new Date()) {
  let title: string;
  let message: string;
  let path: string;
  switch (event.type) {
    case "sale.completed": {
      const d = event.data;
      const free = d.amount <= 0;
      title = `${d.newCustomer ? "🆕 New customer · " : ""}${free ? "🎁 Free order" : "💰 New sale"} — ${d.robotName} · ${tierLabel(d.tier)}`;
      message = [
        title,
        free ? `No charge (${d.provider})` : `${money(d.amount, d.currency)} via ${d.provider}`,
        d.email,
        d.refCode ? `Referral: ${d.refCode}` : null,
        `Order ${d.orderRef}`,
      ]
        .filter(Boolean)
        .join("\n");
      path = "/dashboard/admin/orders";
      break;
    }
    case "user.signup": {
      const d = event.data;
      title = "🆕 New signup";
      message = [title, d.email, d.source === "trial" ? "Started with a free trial" : "Created at checkout"].join("\n");
      path = "/dashboard/admin/users";
      break;
    }
    case "trial.started": {
      const d = event.data;
      title = d.newAccount ? `🆕 New signup · 🧪 free trial — ${d.robotName}` : `🧪 Free trial — ${d.robotName}`;
      message = [title, d.email].join("\n");
      path = "/dashboard/admin/licences";
      break;
    }
    case "webhook.test": {
      title = "✅ Test event";
      message = `${title}\nWebhook "${event.data.webhookName}" is connected to ${SITE}.`;
      path = "/dashboard/admin/webhooks";
      break;
    }
  }
  return {
    id,
    event: event.type,
    created_at: now.toISOString(),
    site: SITE,
    title,
    message,
    path,
    url: `${siteUrl()}${path}`,
    data: event.data,
  };
}

// ── Delivery ────────────────────────────────────────────────────────────────

let warnedMissingTable = false;
function isMissingTable(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021";
}
function reportError(what: string, err: unknown) {
  if (isMissingTable(err)) {
    if (!warnedMissingTable) {
      warnedMissingTable = true;
      console.error(
        `[Webhooks] ${what}: the OutboundWebhook tables are missing. Run "npx prisma migrate deploy" ` +
          "or webhooks will not fire.",
      );
    }
    return;
  }
  console.error(`[Webhooks] ${what}:`, err instanceof Error ? err.message : err);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Endpoint = { id: string; url: string; secret: string; signatureFormat: string };

/** One POST. Never throws; reports what happened. */
export async function postOnce(
  endpoint: Endpoint,
  deliveryId: string,
  eventType: string,
  body: string,
): Promise<{ ok: boolean; httpStatus: number | null; responseBody: string | null; error: string | null; durationMs: number }> {
  const started = Date.now();
  try {
    const url = await assertSafeUrl(endpoint.url);
    const res = await fetch(url, {
      method: "POST",
      redirect: "manual", // a redirect is a misconfigured URL, not something to follow blindly
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "al-ai-fx-webhooks/1.0",
        "X-Webhook-Id": deliveryId,
        "X-Webhook-Event": eventType,
        "X-Webhook-Timestamp": String(Math.floor(Date.now() / 1000)),
        ...signatureHeaders(endpoint.secret, body, endpoint.signatureFormat),
      },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = (await res.text().catch(() => "")).slice(0, KEEP_RESPONSE_CHARS);
    const ok = res.status >= 200 && res.status < 300;
    return {
      ok,
      httpStatus: res.status,
      responseBody: text || null,
      error: ok ? null : res.status >= 300 && res.status < 400 ? `Redirected (${res.status}) — use the final URL` : `HTTP ${res.status}`,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    const message = err instanceof Error ? (err.name === "TimeoutError" ? "Timed out" : err.message) : "Request failed";
    return { ok: false, httpStatus: null, responseBody: null, error: message.slice(0, 300), durationMs: Date.now() - started };
  }
}

/** Attempts a delivery up to `maxAttempts` times and records every outcome. */
export async function runDelivery(deliveryId: string, maxAttempts = ATTEMPT_DELAYS_MS.length): Promise<void> {
  const delivery = await prisma.outboundWebhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { webhook: true },
  });
  if (!delivery) return;
  const body = JSON.stringify(delivery.payload);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await sleep(ATTEMPT_DELAYS_MS[Math.min(attempt, ATTEMPT_DELAYS_MS.length - 1)]);
    const result = await postOnce(delivery.webhook, delivery.id, delivery.event, body);
    await prisma.outboundWebhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: result.ok ? "DELIVERED" : "FAILED",
        attempts: { increment: 1 },
        httpStatus: result.httpStatus,
        responseBody: result.responseBody,
        error: result.error,
        durationMs: result.durationMs,
        lastAttemptAt: new Date(),
        deliveredAt: result.ok ? new Date() : null,
      },
    });
    if (result.ok) return;
    // A 4xx means the receiver understood and refused (bad signature, bad URL):
    // retrying the same body cannot fix that. 5xx, timeouts and network errors can.
    if (result.httpStatus !== null && result.httpStatus >= 400 && result.httpStatus < 500 && result.httpStatus !== 408 && result.httpStatus !== 429) {
      return;
    }
  }
}

let lastPrune = 0;
async function pruneOld() {
  const now = Date.now();
  if (now - lastPrune < 60 * 60_000) return;
  lastPrune = now;
  await prisma.outboundWebhookDelivery.deleteMany({
    where: { createdAt: { lt: new Date(now - RETENTION_DAYS * 24 * 60 * 60_000) } },
  });
}

/**
 * Tells every enabled endpoint that subscribed to this event type. Resolves once
 * the deliveries have been attempted, but never rejects: callers either await it
 * or fire it with `inBackground`.
 */
export async function emitWebhookEvent(event: EventData): Promise<void> {
  try {
    // A trial or order that created the account is sent as one event. Endpoints that only
    // asked for signups still get it, so merging the two never silences one.
    const alsoSignup =
      (event.type === "trial.started" && event.data.newAccount === true) ||
      (event.type === "sale.completed" && event.data.newCustomer === true);
    const endpoints = await prisma.outboundWebhook.findMany({
      where: {
        enabled: true,
        OR: [{ events: { has: event.type } }, ...(alsoSignup ? [{ events: { has: "user.signup" } }] : [])],
      },
    });
    if (endpoints.length === 0) return;
    const body = buildEventBody(event);
    for (const endpoint of endpoints) {
      try {
        const delivery = await prisma.outboundWebhookDelivery.create({
          data: { webhookId: endpoint.id, event: event.type, payload: body as unknown as Prisma.InputJsonValue },
        });
        await runDelivery(delivery.id);
      } catch (err) {
        reportError(`delivery to ${endpoint.name}`, err);
      }
    }
    await pruneOld().catch(() => undefined);
  } catch (err) {
    reportError(`emitting ${event.type}`, err);
  }
}

/** Runs a send without holding up the request that triggered it. */
export function inBackground(task: () => Promise<unknown>) {
  void task().catch((err) => reportError("background task", err));
}

/** Sends a test event to one endpoint regardless of its subscriptions; waits for the result. */
export async function sendTestEvent(webhookId: string) {
  const endpoint = await prisma.outboundWebhook.findUnique({ where: { id: webhookId } });
  if (!endpoint) return null;
  const body = buildEventBody({ type: "webhook.test", data: { webhookName: endpoint.name } });
  const delivery = await prisma.outboundWebhookDelivery.create({
    data: { webhookId: endpoint.id, event: "webhook.test", payload: body as unknown as Prisma.InputJsonValue },
  });
  await runDelivery(delivery.id, 1); // one attempt: the admin is watching
  return prisma.outboundWebhookDelivery.findUniqueOrThrow({ where: { id: delivery.id } });
}
