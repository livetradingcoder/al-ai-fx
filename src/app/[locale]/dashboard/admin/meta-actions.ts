"use server";

import { headers } from "next/headers";
import { getServerSession } from "next-auth";

import type { ActionResult } from "@/lib/action-result";
import { authOptions } from "@/lib/auth";
import { isMetaConfigured } from "@/lib/meta-capi";
import { sendTestEvent } from "@/lib/meta-events";

/**
 * Sends one event to Meta marked as a test, so it shows up under Events
 * Manager > Test events (with the code Meta shows there) and nowhere else. It
 * answers the question "is the token right and is Meta accepting what we send?"
 * without waiting for a real visitor.
 */
export async function sendMetaTestEvent(testEventCode: string): Promise<ActionResult> {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN" || !session.user.email) {
    return { ok: false, error: "Admins only" };
  }

  const code = testEventCode.trim();
  if (!/^[A-Za-z0-9_-]{3,40}$/.test(code)) {
    return {
      ok: false,
      error: "Paste the test event code from Events Manager → Test events. It looks like TEST12345.",
    };
  }
  if (!isMetaConfigured()) {
    return {
      ok: false,
      error: "META_CAPI_ACCESS_TOKEN is not set on the server, so there is nothing to send with.",
    };
  }

  const h = await headers();
  const result = await sendTestEvent({
    testEventCode: code,
    email: session.user.email,
    userId: session.user.id,
    ip: h.get("x-forwarded-for") ?? h.get("x-real-ip"),
    userAgent: h.get("user-agent"),
  });

  if (result.ok) {
    return {
      ok: true,
      message:
        `Meta accepted the test event (${result.eventsReceived ?? 1} received` +
        `${result.fbtraceId ? `, trace ${result.fbtraceId}` : ""}). ` +
        "Open Events Manager → Test events to see it arrive.",
    };
  }
  return {
    ok: false,
    error: `Meta did not accept it: ${result.error ?? "unknown error"}${result.status ? ` (HTTP ${result.status})` : ""}.`,
  };
}
