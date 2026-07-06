import { sendCompileFailedEmail, sendAdminCompilerAlertEmail } from "@/lib/mail";

// Support link baked into the user compile-failed email. Uses the site's real
// /support route. NEXTAUTH_URL is the canonical prod origin; falls back to the
// www apex if unset (e.g. preview deployments without the env var).
const SUPPORT_URL =
  (process.env.NEXTAUTH_URL || "https://www.al-ai-fx.xyz") + "/support";

/**
 * Terminal-failure fan-out, called from BOTH terminal-FAILED sites
 * (/api/compiler/complete retries-exhausted branch AND /api/compiler/reap
 * stuck-job branch). User compile-failed email (DLVR-03) + admin alert
 * (DLVR-04). Every send is best-effort — this helper NEVER throws, so it
 * can never fail the /complete or /reap request.
 */
export async function notifyTerminalFailure(job: {
  id: string;
  attemptCount: number;
  errorMessage: string | null;
  userEmail?: string | null;
  robotName?: string | null;
}): Promise<void> {
  if (job.userEmail && job.robotName) {
    try {
      await sendCompileFailedEmail(job.userEmail, job.robotName, SUPPORT_URL);
    } catch (e) {
      console.error(`[notify] compile-failed user email failed for job ${job.id}:`, e);
    }
  }
  try {
    await sendAdminCompilerAlertEmail({
      kind: "job-failed",
      jobId: job.id,
      attempts: job.attemptCount,
      errorMessage: job.errorMessage ?? undefined,
    });
  } catch (e) {
    console.error(`[notify] admin alert failed for job ${job.id}:`, e);
  }
}
