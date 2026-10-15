import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { buildDashboardMagicLink } from "@/lib/magic-links";
import { mailDeliveryStatus, sendMt5ReminderEmail } from "@/lib/mail";
import { MAX_PER_RUN } from "@/lib/mt5-reminder-schedule";
import { runMt5Reminders } from "@/lib/mt5-reminders";
import { buildReminderOptOutUrl } from "@/lib/reminder-optout";

// Hourly host cron (see /etc/cron.d/al-ai-fx-mt5-reminders): emails the people
// who have a licence but never linked an MT5 account. Same Bearer CRON_SECRET
// auth as /api/compiler/reap.
//
//   ?dry=1   list what would be sent (addresses masked) and send nothing
//   ?max=N   send at most N this run (default and ceiling: MAX_PER_RUN)

// The sign-in button in a reminder is opened hours or days later, so it lives
// longer than the 30 minutes the other emails get.
const SIGN_IN_LINK_LIFETIME = "3d";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get("dry") === "1";
  const requestedMax = Number.parseInt(request.nextUrl.searchParams.get("max") ?? "", 10);
  const max = Number.isFinite(requestedMax) ? Math.min(Math.max(requestedMax, 0), MAX_PER_RUN) : MAX_PER_RUN;

  // A real run needs to be able to mail and to sign links. Refusing up front,
  // before any reminder is claimed, means a misconfigured deploy sends nothing
  // and loses nothing.
  if (!dryRun) {
    if (!mailDeliveryStatus().sending) {
      return Response.json({ error: "Mail is not configured (MAILGUN_API_KEY / MAILGUN_DOMAIN)." }, { status: 503 });
    }
    if (!process.env.NEXTAUTH_SECRET) {
      return Response.json({ error: "NEXTAUTH_SECRET is not set." }, { status: 503 });
    }
  }

  try {
    const result = await runMt5Reminders({
      dryRun,
      max,
      deliver: ({ candidate, kind, stage }) =>
        sendMt5ReminderEmail({
          email: candidate.email,
          kind,
          stage,
          robotName: candidate.robotName,
          expiresAt: candidate.expiresAt,
          magicLinkUrl: buildDashboardMagicLink(
            { email: candidate.email, userId: candidate.userId },
            { expiresIn: SIGN_IN_LINK_LIFETIME, callbackUrl: "/dashboard/onboarding" },
          ),
          optOutUrl: buildReminderOptOutUrl(candidate.userId),
        }),
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    // P2021/P2022: the tables or columns aren't there yet - migrate deploy hasn't run.
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2021" || err.code === "P2022")) {
      console.error("[Reminders] database is missing the reminder tables:", err.message);
      return Response.json({ error: "Reminder tables are missing. Run prisma migrate deploy." }, { status: 503 });
    }
    console.error("[Reminders] run failed:", err);
    return Response.json({ error: "Reminder run failed." }, { status: 500 });
  }
}
