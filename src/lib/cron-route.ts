import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { mailDeliveryStatus } from "@/lib/mail";

// What every cron-driven email route has in common: the Bearer CRON_SECRET
// check (as on /api/compiler/reap), ?dry=1 to list what would go out without
// sending, ?max=N to cap a run, and a refusal up front when the deploy cannot
// send mail. Refusing before anything is claimed means a misconfigured deploy
// sends nothing and loses nothing.

export type EmailCronArgs = { dryRun: boolean; max: number };

export async function runEmailCron(
  request: NextRequest,
  options: {
    /** For the log line and error text, e.g. "Reminders". */
    label: string;
    /** The most one run may send; ?max= can only lower it. */
    ceiling: number;
    run: (args: EmailCronArgs) => Promise<unknown>;
  },
): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get("dry") === "1";
  const requestedMax = Number.parseInt(request.nextUrl.searchParams.get("max") ?? "", 10);
  const max = Number.isFinite(requestedMax) ? Math.min(Math.max(requestedMax, 0), options.ceiling) : options.ceiling;

  if (!dryRun) {
    if (!mailDeliveryStatus().sending) {
      return Response.json({ error: "Mail is not configured (MAILGUN_API_KEY / MAILGUN_DOMAIN)." }, { status: 503 });
    }
    if (!process.env.NEXTAUTH_SECRET) {
      return Response.json({ error: "NEXTAUTH_SECRET is not set." }, { status: 503 });
    }
  }

  try {
    const result = await options.run({ dryRun, max });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    // P2021/P2022: the tables or columns aren't there yet - migrate deploy hasn't run.
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2021" || err.code === "P2022")) {
      console.error(`[${options.label}] database is missing its tables:`, err.message);
      return Response.json({ error: `${options.label} tables are missing. Run prisma migrate deploy.` }, { status: 503 });
    }
    console.error(`[${options.label}] run failed:`, err);
    return Response.json({ error: `${options.label} run failed.` }, { status: 500 });
  }
}
