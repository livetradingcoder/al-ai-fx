/**
 * The events we send to Meta from the server, and the one table they lean on.
 *
 * Each one is sent by the route or webhook that actually causes it, with the
 * same event_id the browser pixel uses (see metaEventId), so Meta counts it once.
 * Everything here swallows its own errors: a tracking problem must never fail a
 * checkout, a webhook or a sign-up. And nothing goes out for a visitor who did
 * not accept advertising cookies.
 */
import { prisma } from "@/lib/prisma";
import {
  buildServerEvent,
  getRecentMetaSends,
  isMetaConfigured,
  metaConfig,
  roundMoney,
  sendMetaEvents,
  type MetaUserInput,
} from "@/lib/meta-capi";
import type { MetaRequestContext } from "@/lib/meta-request";
import { metaEventId, type MetaCustomData, type MetaRelayedEvent } from "@/lib/meta-shared";

const ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Runs a send without holding up the request that triggered it. */
export function inBackground(task: () => Promise<unknown>) {
  void task().catch((err) => {
    console.error("[Meta] background task failed:", err instanceof Error ? err.message : err);
  });
}

// P2021: the table does not exist, i.e. `prisma migrate deploy` has not been
// run since CheckoutAttribution was added. Say so once, loudly, then stay quiet.
let warnedAboutMissingTable = false;
function reportDbError(what: string, err: unknown) {
  const code = (err as { code?: string } | null)?.code;
  if (code === "P2021") {
    if (!warnedAboutMissingTable) {
      warnedAboutMissingTable = true;
      console.error(
        `[Meta] ${what}: the CheckoutAttribution table is missing. Run "npx prisma migrate deploy" ` +
          "or purchases will not reach the Conversions API.",
      );
    }
    return;
  }
  console.error(`[Meta] ${what} failed:`, err instanceof Error ? err.message : err);
}

// --- what the browser looked like when paying started -------------------------

/**
 * Called as a checkout session is created, while the visitor's request is still
 * in hand. The payment webhook that follows has no browser, so it reads this
 * back. Stores nothing unless the visitor accepted ad cookies and there is a
 * token to send with, and drops anything older than 30 days.
 */
export async function rememberCheckoutAttribution(orderRef: string, ctx: MetaRequestContext) {
  if (!ctx.consent || !ctx.userAgent || !isMetaConfigured()) return;
  try {
    const data = {
      fbp: ctx.fbp ?? null,
      fbc: ctx.fbc ?? null,
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent,
      sourceUrl: ctx.sourceUrl ?? null,
    };
    await prisma.checkoutAttribution.upsert({
      where: { orderRef },
      create: { orderRef, ...data },
      update: data,
    });
    await prisma.checkoutAttribution.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - ATTRIBUTION_TTL_MS) } },
    });
  } catch (err) {
    reportDbError("saving checkout attribution", err);
  }
}

async function loadCheckoutAttribution(orderRef: string) {
  try {
    return await prisma.checkoutAttribution.findUnique({ where: { orderRef } });
  } catch (err) {
    reportDbError("reading checkout attribution", err);
    return null;
  }
}

function siteUrl(path: string) {
  const base = (process.env.NEXTAUTH_URL || "https://www.al-ai-fx.xyz").replace(/\/$/, "");
  return `${base}${path}`;
}

function userFrom(ctx: MetaRequestContext, extra: MetaUserInput = {}): MetaUserInput {
  return { ip: ctx.ip, userAgent: ctx.userAgent, fbp: ctx.fbp, fbc: ctx.fbc, ...extra };
}

function productData(input: {
  amount: number;
  currency: string;
  robotSlug: string;
  robotName: string;
  tierSlug: string;
}): MetaCustomData {
  const value = roundMoney(input.amount);
  return {
    value,
    currency: input.currency.toUpperCase(),
    content_type: "product",
    content_ids: [input.robotSlug],
    content_name: input.robotName,
    content_category: input.tierSlug,
    contents: [{ id: input.robotSlug, quantity: 1, item_price: value }],
    num_items: 1,
  };
}

// --- the events ----------------------------------------------------------------

/** A paid order. Read back the attribution saved at checkout, then send. */
export async function sendPurchaseEvent(input: {
  orderRef: string;
  email: string;
  userId: string;
  amount: number;
  currency: string;
  robotSlug: string;
  robotName: string;
  tierSlug: string;
  customer?: Pick<MetaUserInput, "firstName" | "lastName" | "city" | "state" | "zip" | "country">;
}) {
  // A $0 order (a free coupon) is not a purchase, and would drag the value down.
  if (!isMetaConfigured() || !(input.amount > 0)) return;

  const saved = await loadCheckoutAttribution(input.orderRef);
  if (!saved) {
    console.log(
      `[Meta] Purchase ${input.orderRef} not sent: no saved attribution ` +
        "(the visitor did not accept advertising cookies, or the checkout predates tracking).",
    );
    return;
  }

  const event = buildServerEvent({
    name: "Purchase",
    eventId: metaEventId("Purchase", input.orderRef),
    sourceUrl: saved.sourceUrl ?? siteUrl("/checkout"),
    user: {
      email: input.email,
      externalId: input.userId,
      ip: saved.ip,
      userAgent: saved.userAgent,
      fbp: saved.fbp,
      fbc: saved.fbc,
      ...input.customer,
    },
    custom: { ...productData(input), order_id: input.orderRef },
  });
  if (event) await sendMetaEvents([event]);
}

/** The buyer picked a payment method; the order exists, the money has not moved. */
export async function sendAddPaymentInfoEvent(input: {
  ctx: MetaRequestContext;
  orderRef: string;
  email: string;
  amount: number;
  currency: string;
  robotSlug: string;
  robotName: string;
  tierSlug: string;
}) {
  if (!isMetaConfigured() || !input.ctx.consent) return;
  const { value, currency, content_ids, content_type, contents } = productData(input);
  const event = buildServerEvent({
    name: "AddPaymentInfo",
    eventId: metaEventId("AddPaymentInfo", input.orderRef),
    sourceUrl: input.ctx.sourceUrl,
    user: userFrom(input.ctx, { email: input.email }),
    custom: { value, currency, content_ids, content_type, contents },
  });
  if (event) await sendMetaEvents([event]);
}

/** A new free trial: the trial itself and the account it created. */
export async function sendTrialEvents(input: {
  ctx: MetaRequestContext;
  email: string;
  userId: string;
  subscriptionId: string;
  robotSlug: string;
  robotName: string;
}) {
  if (!isMetaConfigured() || !input.ctx.consent) return;
  const user = userFrom(input.ctx, { email: input.email, externalId: input.userId });
  const events = [
    buildServerEvent({
      name: "StartTrial",
      eventId: metaEventId("StartTrial", input.subscriptionId),
      sourceUrl: input.ctx.sourceUrl,
      user,
      custom: { value: 0, currency: "USD", content_ids: [input.robotSlug], content_name: input.robotName },
    }),
    buildServerEvent({
      name: "CompleteRegistration",
      eventId: metaEventId("CompleteRegistration", input.userId),
      sourceUrl: input.ctx.sourceUrl,
      user,
      custom: { content_name: input.robotName },
    }),
  ].filter((e) => e !== null);
  if (events.length) await sendMetaEvents(events);
}

/**
 * A browsing event the page reported to /api/meta/event. The visitor's browser
 * has already sent the pixel copy with the same event_id; this is the copy that
 * survives an ad blocker. If they are signed in we know who they are.
 */
export async function sendRelayedEvent(input: {
  ctx: MetaRequestContext;
  name: MetaRelayedEvent;
  eventId: string;
  custom: MetaCustomData;
  email?: string | null;
  userId?: string | null;
}) {
  if (!isMetaConfigured() || !input.ctx.consent) return;
  const event = buildServerEvent({
    name: input.name,
    eventId: input.eventId,
    sourceUrl: input.ctx.sourceUrl,
    user: userFrom(input.ctx, { email: input.email, externalId: input.userId }),
    custom: input.custom,
  });
  if (event) await sendMetaEvents([event]);
}

/** The admin "send a test event" button. Goes to Events Manager's Test Events tab only. */
export async function sendTestEvent(input: {
  testEventCode: string;
  email: string;
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const event = buildServerEvent({
    name: "ViewContent",
    eventId: `test:${crypto.randomUUID()}`,
    sourceUrl: siteUrl("/"),
    user: { email: input.email, externalId: input.userId, ip: input.ip, userAgent: input.userAgent },
    custom: { content_name: "Admin test event", content_type: "product", content_ids: ["admin-test"] },
  });
  if (!event) {
    return { ok: false, skipped: true, test: true, error: "Could not build the test event (no browser user agent)." };
  }
  return sendMetaEvents([event], { testEventCode: input.testEventCode });
}

// --- for the admin page ----------------------------------------------------------

export async function metaTrackingStatus() {
  const config = metaConfig();
  let table: "ok" | "missing" | "error" = "ok";
  try {
    await prisma.checkoutAttribution.count();
  } catch (err) {
    table = (err as { code?: string } | null)?.code === "P2021" ? "missing" : "error";
  }
  return {
    pixelId: config.pixelId,
    tokenSet: config.token !== null,
    testMode: config.testEventCode !== null,
    version: config.version,
    table,
    recent: getRecentMetaSends().slice(0, 6),
  };
}
