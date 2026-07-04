import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  HEARTBEAT_STALE_SECONDS,
  HEARTBEAT_DEAD_SECONDS,
  STUCK_JOB_MINUTES,
} from "@/lib/compiler-config";

/**
 * GET /api/admin/compiler-status
 *
 * ADMIN-gated read of WorkerHeartbeat.lastSeenAt + job-queue health counters.
 * Powers the Compile Server tile on /dashboard/admin (polled every 15s).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return new Response("Forbidden", { status: 403 });
  }

  const now = new Date();
  const stuckCutoff = new Date(now.getTime() - STUCK_JOB_MINUTES * 60_000);
  const day = new Date(now.getTime() - 24 * 60 * 60_000);

  const [heartbeat, oldestPending, processingCount, stuckCount, failedLast24h] = await Promise.all([
    prisma.workerHeartbeat.findUnique({ where: { id: "compiler" } }),
    prisma.compilation.findFirst({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.compilation.count({ where: { status: "PROCESSING" } }),
    prisma.compilation.count({
      where: { status: "PROCESSING", attemptedAt: { lt: stuckCutoff } },
    }),
    prisma.compilation.count({
      where: { status: "FAILED", updatedAt: { gt: day } },
    }),
  ]);

  const lastSeenAgoSeconds = heartbeat
    ? Math.floor((now.getTime() - heartbeat.lastSeenAt.getTime()) / 1000)
    : null;

  let status: "green" | "stale" | "red";
  if (lastSeenAgoSeconds === null || lastSeenAgoSeconds > HEARTBEAT_DEAD_SECONDS) {
    status = "red";
  } else if (lastSeenAgoSeconds > HEARTBEAT_STALE_SECONDS) {
    status = "stale";
  } else {
    status = "green";
  }

  const oldestPendingAgeSeconds = oldestPending
    ? Math.floor((now.getTime() - oldestPending.createdAt.getTime()) / 1000)
    : null;

  return Response.json({
    status,
    lastSeenAgoSeconds,
    oldestPendingAgeSeconds,
    processingCount,
    stuckCount,
    failedLast24h,
    thresholds: {
      heartbeatStaleSeconds: HEARTBEAT_STALE_SECONDS,
      heartbeatDeadSeconds: HEARTBEAT_DEAD_SECONDS,
      stuckJobMinutes: STUCK_JOB_MINUTES,
    },
  });
}
