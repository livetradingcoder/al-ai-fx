import { prisma } from "@/lib/prisma";

// A subscription is created ACTIVE with an expiry date, and nothing else used to
// move it on: a trial that ended last week still read ACTIVE on every admin chip,
// count and "your licence" page, and buying the same plan again after it lapsed
// was mistaken for a duplicate and never extended. Lapsed rows are marked EXPIRED
// here — by the daily housekeeping job, and (throttled) by the pages that show
// licence status, so a chip is at most a minute behind the clock.

const lapsedWhere = (now: Date) => ({ status: "ACTIVE" as const, expiresAt: { lte: now } });

/** Marks every ACTIVE subscription whose expiry has passed as EXPIRED. Returns how many. */
export async function expireLapsedSubscriptions(now: Date = new Date()): Promise<number> {
  const { count } = await prisma.subscription.updateMany({ where: lapsedWhere(now), data: { status: "EXPIRED" } });
  return count;
}

/** How many would be marked by expireLapsedSubscriptions (for dry runs). */
export function countLapsedSubscriptions(now: Date = new Date()): Promise<number> {
  return prisma.subscription.count({ where: lapsedWhere(now) });
}

const MIN_INTERVAL_MS = 60_000;
let lastSync = 0;

/**
 * Cheap enough to call on every render of a page that shows licence status: it
 * runs at most once a minute per server process and never throws, so a database
 * hiccup can't take the page down with it.
 */
export async function syncLapsedSubscriptions(): Promise<void> {
  const now = Date.now();
  if (now - lastSync < MIN_INTERVAL_MS) return;
  lastSync = now;
  try {
    const expired = await expireLapsedSubscriptions(new Date(now));
    if (expired > 0) console.log(`[Subscriptions] marked ${expired} lapsed subscription(s) EXPIRED`);
  } catch (err) {
    lastSync = 0; // try again on the next request
    console.error("[Subscriptions] expiry sync failed:", err instanceof Error ? err.message : err);
  }
}
