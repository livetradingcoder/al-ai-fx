import { Prisma } from "@prisma/client";

import { isPublicIp, normalizeIp } from "@/lib/client-ip";
import { countryOfIp } from "@/lib/geo-country";
import { prisma } from "@/lib/prisma";

// The addresses each person has used, with the country each is in. Recorded
// when someone signs in, starts a free trial or links an MT5 account; shown to
// admins, and used to spot several accounts coming from one place. Rows are
// deleted a year after the address was last seen (see the housekeeping cron).

export type IpSource = "login" | "trial" | "mt5";

/** Seeing the same address again within this long only touches the row if its country is still unknown. */
const REFRESH_AFTER_MS = 10 * 60_000;

/**
 * Records that this person was seen at this address. Best effort and silent:
 * a bookkeeping problem (a missing table before the migration, a database
 * blip) must never get in the way of the sign-in or the licence it rides on.
 */
export async function recordUserIp(input: {
  userId: string;
  ip: string | null | undefined;
  source: IpSource;
  now?: Date;
}): Promise<void> {
  const ip = normalizeIp(input.ip);
  if (!ip || !isPublicIp(ip)) return;
  const now = input.now ?? new Date();

  try {
    const existing = await prisma.userIp.findUnique({
      where: { userId_ip: { userId: input.userId, ip } },
      select: { id: true, country: true, lastSeenAt: true },
    });

    if (existing) {
      if (existing.country && now.getTime() - existing.lastSeenAt.getTime() < REFRESH_AFTER_MS) return;
      await prisma.userIp.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: now,
          hits: { increment: 1 },
          ...(existing.country ? {} : { country: await countryOfIp(ip) }),
        },
      });
      return;
    }

    await prisma.userIp.create({
      data: { userId: input.userId, ip, country: await countryOfIp(ip), source: input.source, firstSeenAt: now, lastSeenAt: now },
    });
  } catch (err) {
    // Another request created the same row a moment ago: nothing to add.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
    console.error("[UserIp] could not record address:", err instanceof Error ? err.message : err);
  }
}
