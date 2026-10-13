import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { inBackground, sendRelayedEvent } from "@/lib/meta-events";
import { isMetaConfigured } from "@/lib/meta-capi";
import { readMetaRequestContext, sanitizeCustomData } from "@/lib/meta-request";
import { META_RELAYED_EVENTS, type MetaRelayedEvent } from "@/lib/meta-shared";
import { checkMetaEventRateLimit, getClientIdentifier } from "@/lib/rate-limit";

const EVENT_ID = /^[A-Za-z0-9_:.-]{8,100}$/;
const MAX_BODY_BYTES = 4096;

/**
 * POST /api/meta/event { event, eventId, url?, data? }
 *
 * The page fires the pixel copy of a browsing event (ViewContent, AddToCart,
 * InitiateCheckout) and reports the same event here with the same eventId; we
 * add what only the server can see (IP, user agent, the signed-in user) and
 * relay it to the Conversions API, so it still counts when an ad blocker eats
 * the pixel. Meta merges the two copies by event_id.
 *
 * Only those three names are accepted. Purchases, trials and sign-ups are sent
 * by the routes that cause them, so nothing posted here can pass for one.
 * Answers 204 whether or not anything was sent: the page cannot act on it.
 */
export async function POST(req: Request) {
  const { success } = await checkMetaEventRateLimit(getClientIdentifier(req));
  if (!success) return new NextResponse(null, { status: 429 });

  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    body = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const { event, eventId, url, data } = body;
  if (typeof event !== "string" || !(META_RELAYED_EVENTS as readonly string[]).includes(event)) {
    return new NextResponse(null, { status: 400 });
  }
  if (typeof eventId !== "string" || !EVENT_ID.test(eventId)) {
    return new NextResponse(null, { status: 400 });
  }

  const ctx = readMetaRequestContext(req, { sourceUrl: typeof url === "string" ? url : null });
  // Nothing to send for a visitor who has not accepted, or with no token set.
  if (!ctx.consent || !isMetaConfigured()) return new NextResponse(null, { status: 204 });

  // Only a live session identifies anyone. A revoked or deleted account's token
  // keeps its email but loses its id (see the jwt callback), so require the id.
  const session = await getServerSession(authOptions).catch(() => null);
  const user = session?.user?.id ? session.user : null;
  inBackground(() =>
    sendRelayedEvent({
      ctx,
      name: event as MetaRelayedEvent,
      eventId,
      custom: sanitizeCustomData(data),
      email: user?.email,
      userId: user?.id,
    }),
  );
  return new NextResponse(null, { status: 204 });
}
