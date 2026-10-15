import { countryName } from "@/lib/geo-country";
import { prisma } from "@/lib/prisma";

// What the admin Customers page shows about where each person comes from, built
// from the UserIp rows. Plain data (no Dates), because it is handed to a
// client component.

export type UserLocation = {
  /** The address they used most recently. */
  ip: string;
  /** ISO country code of that address, when known. */
  country: string | null;
  countryName: string | null;
  lastSeenAt: string;
  /** How many different addresses we have seen from them. */
  addresses: number;
  /** How many OTHER accounts have used any of the same addresses. A hint, not a verdict: homes, offices and phone networks share addresses. */
  sharedWith: number;
};

/** Empty when the table doesn't exist yet or the lookup fails: the page still renders. */
export async function loadUserLocations(userIds: string[]): Promise<Map<string, UserLocation>> {
  const result = new Map<string, UserLocation>();
  if (userIds.length === 0) return result;

  try {
    const rows = await prisma.userIp.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, ip: true, country: true, lastSeenAt: true },
      orderBy: { lastSeenAt: "desc" },
    });

    const byUser = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byUser.get(row.userId);
      if (list) list.push(row);
      else byUser.set(row.userId, [row]);
    }

    // Which of those addresses has more than one account behind it, and who.
    const addresses = [...new Set(rows.map((row) => row.ip))];
    const accountsAt = new Map<string, Set<string>>();
    if (addresses.length > 0) {
      const shared = await prisma.userIp.groupBy({
        by: ["ip"],
        where: { ip: { in: addresses } },
        _count: { userId: true },
        having: { userId: { _count: { gt: 1 } } },
      });
      if (shared.length > 0) {
        const sharers = await prisma.userIp.findMany({
          where: { ip: { in: shared.map((row) => row.ip) } },
          select: { userId: true, ip: true },
        });
        for (const row of sharers) {
          const set = accountsAt.get(row.ip);
          if (set) set.add(row.userId);
          else accountsAt.set(row.ip, new Set([row.userId]));
        }
      }
    }

    for (const [userId, own] of byUser) {
      const others = new Set<string>();
      for (const row of own) {
        for (const id of accountsAt.get(row.ip) ?? []) if (id !== userId) others.add(id);
      }
      const latest = own[0];
      result.set(userId, {
        ip: latest.ip,
        country: latest.country,
        countryName: countryName(latest.country),
        lastSeenAt: latest.lastSeenAt.toISOString(),
        addresses: own.length,
        sharedWith: others.size,
      });
    }
  } catch (err) {
    console.error("[admin] could not load user locations:", err instanceof Error ? err.message : err);
  }

  return result;
}
