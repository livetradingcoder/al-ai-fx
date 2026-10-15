import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { isCronAuthorized } from "@/lib/cron-route";
import { runHousekeeping } from "@/lib/housekeeping";

// Daily host cron (see /etc/cron.d/al-ai-fx-housekeeping): deletes IP addresses
// and sign-in records a year after they were last seen, and fills in the
// country of addresses recorded without one. ?dry=1 only counts. Same Bearer
// CRON_SECRET auth as the other cron routes.
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await runHousekeeping({ dryRun: request.nextUrl.searchParams.get("dry") === "1" });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    // P2021/P2022: the tables aren't there yet - migrate deploy hasn't run.
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2021" || err.code === "P2022")) {
      console.error("[Housekeeping] database is missing its tables:", err.message);
      return Response.json({ error: "Tables are missing. Run prisma migrate deploy." }, { status: 503 });
    }
    console.error("[Housekeeping] run failed:", err);
    return Response.json({ error: "Housekeeping run failed." }, { status: 500 });
  }
}
