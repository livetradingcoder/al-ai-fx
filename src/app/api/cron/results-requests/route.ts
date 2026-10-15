import type { NextRequest } from "next/server";

import { runEmailCron } from "@/lib/cron-route";
import { sendResultsRequestEmail } from "@/lib/mail";
import { buildReminderOptOutUrl } from "@/lib/reminder-optout";
import { RESULTS_MAX_PER_RUN } from "@/lib/results-request-schedule";
import { runResultsRequests } from "@/lib/results-requests";

// Daily host cron (see /etc/cron.d/al-ai-fx-results-requests): once a
// customer's first build has been ready for a few days, asks them once how it
// is going and for their results. Auth and ?dry=1 / ?max=N are handled by
// runEmailCron.
export async function GET(request: NextRequest) {
  return runEmailCron(request, {
    label: "Results",
    ceiling: RESULTS_MAX_PER_RUN,
    run: ({ dryRun, max }) =>
      runResultsRequests({
        dryRun,
        max,
        deliver: ({ candidate, daysWithRobot }) =>
          sendResultsRequestEmail({
            email: candidate.email,
            robotName: candidate.robotName,
            daysWithRobot,
            optOutUrl: buildReminderOptOutUrl(candidate.userId),
          }),
      }),
  });
}
