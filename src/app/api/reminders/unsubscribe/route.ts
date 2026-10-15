import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { verifyReminderOptOutToken } from "@/lib/reminder-optout";

// The unsubscribe link in a setup-reminder email.
//
// GET only shows a confirmation button. Mail scanners and link previewers open
// every link in a message, so a GET that opted people out would quietly
// unsubscribe anyone whose mail is scanned. The button POSTs back here, and
// that is what records the opt-out. It is also the one-click endpoint mail
// clients call (RFC 8058, the List-Unsubscribe-Post header) - they send a POST
// with no browser Origin, which the CSRF check in proxy.ts lets through.
//
// Idempotent, and it answers the same whether or not the person still exists.

const HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

function page(title: string, body: string, status: number) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${title}</title>
</head>
<body style="background:#0c0907;color:#e5dccb;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;">
  <div style="max-width:480px;text-align:center;">
    <h1 style="color:#fff7e3;font-size:22px;">${title}</h1>
    <p style="color:#d8d1c3;font-size:15px;line-height:1.6;">${body}</p>
  </div>
</body>
</html>`;
  return new NextResponse(html, { status, headers: HEADERS });
}

const invalid = () => page("Link not valid", "This unsubscribe link is invalid or expired.", 400);

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!verifyReminderOptOutToken(token)) return invalid();

  const action = `/api/reminders/unsubscribe?token=${encodeURIComponent(token)}`;
  return page(
    "Stop setup reminders?",
    `We will stop emailing you about linking your MT5 account. Emails about your purchases, downloads and account are not affected.
    <form method="post" action="${action}" style="margin-top:24px;">
      <button type="submit" style="background:#f4dca2;color:#1a130c;border:0;padding:14px 22px;border-radius:999px;font-weight:700;font-size:15px;cursor:pointer;">Stop these reminders</button>
    </form>`,
    200,
  );
}

export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const userId = verifyReminderOptOutToken(token);
  if (!userId) return invalid();

  try {
    await prisma.reminderOptOut.upsert({ where: { userId }, update: {}, create: { userId } });
  } catch (err) {
    // The account no longer exists: there is nothing left to remind.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003")) {
      console.error("[Reminders] opt-out failed:", err);
      return page("Something went wrong", "We could not save that just now. Please try the link again in a moment.", 500);
    }
  }

  return page("You are unsubscribed", "You will not receive further setup reminders. Emails about your purchases, downloads and account will still reach you.", 200);
}
