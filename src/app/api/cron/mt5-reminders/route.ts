import type { NextRequest } from "next/server";

import { runEmailCron } from "@/lib/cron-route";
import { buildDashboardMagicLink } from "@/lib/magic-links";
import { sendMt5ReminderEmail } from "@/lib/mail";
import { MAX_PER_RUN } from "@/lib/mt5-reminder-schedule";
import { runMt5Reminders } from "@/lib/mt5-reminders";
import { buildReminderOptOutUrl } from "@/lib/reminder-optout";

// Hourly host cron (see /etc/cron.d/al-ai-fx-mt5-reminders): emails the people
// who have a licence but never linked an MT5 account. Auth and ?dry=1 / ?max=N
// are handled by runEmailCron.

// The sign-in button in a reminder is opened hours or days later, so it lives
// longer than the 30 minutes the other emails get.
const SIGN_IN_LINK_LIFETIME = "3d";

export async function GET(request: NextRequest) {
  return runEmailCron(request, {
    label: "Reminders",
    ceiling: MAX_PER_RUN,
    run: ({ dryRun, max }) =>
      runMt5Reminders({
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
      }),
  });
}
