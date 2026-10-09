import { NextResponse } from "next/server";
import { webhooks } from "@polar-sh/sdk/2026-10";

/**
 * Polar webhook endpoint. The signature is verified against
 * POLAR_WEBHOOK_SECRET before anything is handled. Must stay public — Polar
 * doesn't follow redirects; /api/webhooks/* is already CSRF-exempt in proxy.ts.
 */
export async function POST(req: Request) {
  const secret = process.env.POLAR_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const body = await req.text(); // raw body — signature fails on re-serialized JSON
  let event: Awaited<ReturnType<typeof webhooks.validateEvent>>;
  try {
    event = await webhooks.validateEvent(
      body,
      {
        "webhook-id": req.headers.get("webhook-id") ?? "",
        "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
        "webhook-signature": req.headers.get("webhook-signature") ?? "",
      },
      secret,
    );
  } catch (error) {
    if (error instanceof webhooks.PolarWebhookVerificationError) {
      return NextResponse.json({ received: false }, { status: 403 });
    }
    if (error instanceof webhooks.PolarWebhookError) {
      return NextResponse.json({ received: false }, { status: 400 });
    }
    throw error;
  }

  switch (event.type) {
    case "order.paid":
      // TODO: provision the purchase (event.data is the Order). Polar may
      // redeliver — dedupe on the webhook-id header, not event.data.id.
      break;
    case "customer.state_changed":
      // TODO: sync the customer's active subscriptions/benefits (event.data is
      // the customer state) into the user's subscription/license rows.
      break;
  }

  return NextResponse.json({ received: true });
}
