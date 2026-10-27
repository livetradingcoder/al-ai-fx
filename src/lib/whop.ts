import { createHmac, timingSafeEqual } from "node:crypto";

// Whop card checkout (https://docs.whop.com). Env (Coolify → al-ai-fx → env):
//   WHOP_API_KEY         Account API key (Whop dashboard → Developer). Authenticates
//                        checkout creation. Server only.
//   WHOP_WEBHOOK_SECRET  `ws_…` signing secret of the /api/webhooks/whop endpoint.
//   WHOP_PRODUCT_ID      `prod_…` the checkouts are sold under. One product is enough;
//                        the robot and tier are carried in metadata and the plan title.
//   WHOP_PRODUCTS_JSON   optional {"<robot slug>":"prod_…"} to sell a robot under its
//                        own product instead (falls back to WHOP_PRODUCT_ID).
//   WHOP_ACCOUNT_ID      optional `biz_…`; account keys already imply it.
//   WHOP_API_BASE        optional override (e.g. https://sandbox-api.whop.com/api/v1).
//
// The company on Whop is shared with other apps, so its webhook delivers every
// payment of every product. The webhook therefore only acts on payments that carry
// our own `source` marker in metadata and quietly acknowledges the rest.

const DEFAULT_BASE = "https://api.whop.com/api/v1";
// Whop versions its API by date, and a key without a pin falls back to the 2025
// behaviour (company_id, plain-number totals, nested objects). Everything here is
// written against 2026-10-13: account_id, Money objects, flat plan_id/product_id.
export const WHOP_API_VERSION_DATE = "2026-10-13";
export const WHOP_SOURCE = "al-ai-fx";

export function whopKey(): string | null {
  const key = process.env.WHOP_API_KEY?.trim();
  return key ? key : null;
}

export function whopWebhookSecret(): string | null {
  const secret = process.env.WHOP_WEBHOOK_SECRET?.trim();
  return secret ? secret : null;
}

// Whether the Whop button should be offered: key + at least one product.
export function whopEnabled(): boolean {
  return whopKey() !== null && (whopProductId("") !== null || Boolean(process.env.WHOP_PRODUCTS_JSON?.trim()));
}

export function whopProductId(robotSlug: string): string | null {
  const raw = process.env.WHOP_PRODUCTS_JSON?.trim();
  if (raw && robotSlug) {
    try {
      const map = JSON.parse(raw) as Record<string, unknown>;
      const id = map[robotSlug];
      if (typeof id === "string" && id.trim()) return id.trim();
    } catch {
      console.error("[Whop] WHOP_PRODUCTS_JSON is not valid JSON — ignoring it");
    }
  }
  const fallback = process.env.WHOP_PRODUCT_ID?.trim();
  return fallback ? fallback : null;
}

export function whopOrderRef(orderRef: string): string {
  return `WHOP-${orderRef}`;
}

type WhopError = { error?: { type?: string; message?: string } };

export async function whopFetch<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
  const key = whopKey();
  if (!key) throw new Error("whop not configured");
  const base = (process.env.WHOP_API_BASE?.trim() || DEFAULT_BASE).replace(/\/$/, "");
  const { idempotencyKey, ...rest } = init;
  const res = await fetch(`${base}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Api-Version-Date": WHOP_API_VERSION_DATE,
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json().catch(() => ({}))) as T & WhopError;
  if (!res.ok) throw new Error(json.error?.message || `whop ${res.status}`);
  return json;
}

export interface WhopCheckoutInput {
  robotSlug: string;
  robotName: string;
  tier: string;
  tierLabel: string;
  amountUsd: number; // what the buyer pays, after our own discounts
  expirationDays: number | null; // access length of the plan; null = no expiry
  orderRef: string; // our uuid (without the WHOP- prefix)
  email: string;
  refCode: string | null;
  couponCode: string | null;
  redirectUrl: string;
  /** An account-change fee only: the licence the paid change is for. */
  subscriptionId?: string | null;
}

export interface WhopCheckout {
  id: string;
  purchaseUrl: string;
}

// Whop variants (plans) can't be priced below 1.00 for paid fiat.
export const WHOP_MIN_AMOUNT = 1;

// POST /checkout_configurations with an inline plan: Whop creates (or reuses) a
// matching one-time variant, so the price always comes from our database and
// discounts are applied before the buyer reaches Whop. metadata is copied onto the
// payment, which is how the webhook knows what to provision.
export async function createWhopCheckout(input: WhopCheckoutInput): Promise<WhopCheckout> {
  const productId = whopProductId(input.robotSlug);
  if (!productId) throw new Error(`no whop product for ${input.robotSlug}`);
  const accountId = process.env.WHOP_ACCOUNT_ID?.trim();
  const json = await whopFetch<{ id?: string; purchase_url?: string | null }>("/checkout_configurations", {
    method: "POST",
    idempotencyKey: `al-ai-fx-${input.orderRef}`,
    body: JSON.stringify({
      ...(accountId ? { account_id: accountId } : {}),
      plan: {
        product_id: productId,
        plan_type: "one_time",
        currency: "usd",
        initial_price: Math.round(input.amountUsd * 100) / 100,
        title: `${input.robotName} · ${input.tierLabel}`.slice(0, 30),
        visibility: "hidden",
        ...(input.expirationDays ? { expiration_days: input.expirationDays } : {}),
        metadata: { source: WHOP_SOURCE, robot: input.robotSlug, tier: input.tier },
      },
      metadata: {
        source: WHOP_SOURCE,
        order_ref: input.orderRef,
        robot: input.robotSlug,
        tier: input.tier,
        email: input.email,
        amount: input.amountUsd.toFixed(2),
        ...(input.refCode ? { ref: input.refCode } : {}),
        ...(input.couponCode ? { coupon: input.couponCode } : {}),
        ...(input.subscriptionId ? { subscription: input.subscriptionId } : {}),
      },
      redirect_url: input.redirectUrl,
    }),
  });
  if (!json.id || !json.purchase_url) throw new Error("whop returned no purchase_url");
  return { id: json.id, purchaseUrl: json.purchase_url };
}

// ── Webhook verification (Standard Webhooks) ────────────────────────────────

const TOLERANCE_SECONDS = 5 * 60;

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Whop signs `${webhook-id}.${webhook-timestamp}.${rawBody}` with HMAC-SHA256,
 * keyed with the `ws_…` secret exactly as shown (prefix kept, not decoded), and
 * sends `webhook-signature: v1,<base64>` — possibly several, space separated.
 * Verify the raw body; a re-serialised one will not match. Stale timestamps are
 * refused to blunt replays.
 */
export function verifyWhopWebhook(
  secret: string,
  rawBody: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
  return signature
    .split(" ")
    .map((part) => part.split(",", 2))
    .some(([version, value]) => version === "v1" && typeof value === "string" && safeEqual(expected, value));
}

// ── Payment payload ──────────────────────────────────────────────────────────

type Money = { amount?: string | number; currency?: string } | null | undefined;

export interface WhopPayment {
  id?: string;
  status?: string;
  substatus?: string;
  currency?: string;
  customer_email?: string | null;
  user?: { email?: string | null } | null;
  // The REST API sends these as plain numbers in major units; the webhook
  // payload was first read as { amount, currency }, so both shapes are accepted.
  total?: Money | number;
  usd_total?: number | null;
  metadata?: Record<string, unknown> | null;
}

// membership.activated payload — only what the fallback needs.
export interface WhopMembership {
  id?: string;
  status?: string;
  metadata?: Record<string, unknown> | null;
  user?: { email?: string | null } | null;
}

export interface WhopEvent {
  id?: string;
  type?: string;
  data?: WhopPayment & WhopMembership;
}

function metaString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export interface WhopPaymentTarget {
  orderRef: string;
  robotSlug: string;
  tierSlug: string;
  email: string | null;
  refCode: string | null;
  couponCode: string | null;
  /** Account-change fee only: the licence the paid change is for. */
  subscriptionId: string | null;
  // The price we asked Whop to charge (metadata.amount). Only used when the
  // order has to be provisioned from a membership event, which carries no payment.
  expectedAmount: number | null;
}

// What a payment bought, from the metadata we set at checkout. null when the
// payment is not ours (another product or app in the same Whop company).
export function resolveWhopPaymentTarget(
  payment: Pick<WhopPayment, "metadata" | "customer_email" | "user">,
): WhopPaymentTarget | null {
  const meta = payment.metadata ?? {};
  if (meta.source !== WHOP_SOURCE) return null;
  const orderRef = metaString(meta.order_ref);
  const robotSlug = metaString(meta.robot);
  const tierSlug = metaString(meta.tier);
  if (!orderRef || !robotSlug || !tierSlug) return null;
  const email =
    (metaString(meta.email) ?? metaString(payment.customer_email) ?? metaString(payment.user?.email))?.toLowerCase() ??
    null;
  const expected = Number.parseFloat(metaString(meta.amount) ?? "");
  return {
    orderRef,
    robotSlug: robotSlug.toLowerCase(),
    tierSlug: tierSlug.toLowerCase(),
    email,
    refCode: metaString(meta.ref),
    couponCode: metaString(meta.coupon),
    subscriptionId: metaString(meta.subscription),
    expectedAmount: Number.isFinite(expected) && expected >= 0 ? expected : null,
  };
}

// What the buyer actually paid (after any Whop promo code), in USD. Whop's
// payment object carries `total` as a plain number in major units (and
// `usd_total`, its USD equivalent); an older reading had it as Money,
// { amount: "29.00", currency: "usd" }. A total this cannot read is null, and
// the webhook then refuses the payment — so every shape has to be handled.
export function whopPaymentAmount(
  payment: Pick<WhopPayment, "total" | "currency"> & { usd_total?: number | null },
): { amount: number; currency: string } | null {
  if (typeof payment.usd_total === "number" && Number.isFinite(payment.usd_total) && payment.usd_total >= 0) {
    return { amount: payment.usd_total, currency: "USD" };
  }
  const total = payment.total;
  const money = total !== null && typeof total === "object" ? total : null;
  const raw = money ? money.amount : total;
  const amount = typeof raw === "number" ? raw : Number.parseFloat(String(raw ?? ""));
  if (!Number.isFinite(amount) || amount < 0) return null;
  const currency = (money?.currency ?? payment.currency ?? "usd").toUpperCase();
  return { amount, currency };
}

// GET /payments/{id}: the payment as Whop holds it, for confirming a return
// from checkout without waiting on the webhook.
export function fetchWhopPayment(paymentId: string): Promise<WhopPayment> {
  return whopFetch<WhopPayment>(`/payments/${encodeURIComponent(paymentId)}`);
}

// payment.succeeded carries status "paid"; anything else on a succeeded event is
// unexpected, so don't fulfil it.
export function isWhopPaid(payment: Pick<WhopPayment, "status" | "substatus">): boolean {
  if (payment.status !== undefined && payment.status !== "paid") return false;
  if (payment.substatus !== undefined && payment.substatus !== "succeeded") return false;
  return true;
}

// membership.activated is the fallback for purchases that carry no paid payment
// (a 100%-off promo code): the membership is what proves the buyer got in.
export function isWhopMembershipLive(membership: Pick<WhopMembership, "status">): boolean {
  return membership.status === undefined || ["active", "completed", "trialing"].includes(membership.status);
}
