import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Free-trial abuse limits.
 *
 * The Subscription unique index already stops one account claiming the same
 * robot's trial twice. What it cannot see is one person cycling throwaway
 * addresses, so two blunt limits sit in front of it:
 *
 *  - a per-IP cooldown, which costs a determined cheater a new network, and
 *  - a global monthly cap, which bounds the damage if they find one.
 *
 * Both are deliberately coarse. A trial costs a compile and a licence, not a
 * payout, so the goal is to make farming tedious — not to fingerprint people.
 */
export const TRIAL_IP_COOLDOWN_DAYS = Number(process.env.TRIAL_IP_COOLDOWN_DAYS ?? 30);
export const TRIAL_MONTHLY_CAP = Number(process.env.TRIAL_MONTHLY_CAP ?? 50);

const DAY_MS = 86_400_000;

function hash(value: string) {
  const salt = process.env.NEXTAUTH_SECRET ?? "al-ai-fx";
  return createHash("sha256").update(`${value}:${salt}`).digest("hex").slice(0, 32);
}

export const hashTrialIp = (ip: string | null | undefined) => (ip ? hash(ip) : null);
export const hashTrialEmail = (email: string) => hash(email.trim().toLowerCase());

export type TrialAvailability = {
  available: boolean;
  reason: "ok" | "ip-cooldown" | "monthly-cap";
  message: string;
  /** When this visitor could try again. Null when nothing is blocking. */
  resetsAt: string | null;
};

/** Cheap enough to call on a page render — two counts over indexed columns. */
export async function checkTrialAvailability(ipHash: string | null): Promise<TrialAvailability> {
  const now = Date.now();

  try {
    const monthStart = new Date(now - 30 * DAY_MS);
    const claimedThisMonth = await prisma.trialClaim.count({
      where: { createdAt: { gte: monthStart } },
    });

    if (claimedThisMonth >= TRIAL_MONTHLY_CAP) {
      const oldest = await prisma.trialClaim.findFirst({
        where: { createdAt: { gte: monthStart } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });
      const resetsAt = oldest ? new Date(oldest.createdAt.getTime() + 30 * DAY_MS) : null;
      return {
        available: false,
        reason: "monthly-cap",
        message: "This month's free trials have all been claimed. Check back soon.",
        resetsAt: resetsAt?.toISOString() ?? null,
      };
    }

    if (ipHash) {
      const since = new Date(now - TRIAL_IP_COOLDOWN_DAYS * DAY_MS);
      const recent = await prisma.trialClaim.findFirst({
        where: { ipHash, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      if (recent) {
        const resetsAt = new Date(recent.createdAt.getTime() + TRIAL_IP_COOLDOWN_DAYS * DAY_MS);
        return {
          available: false,
          reason: "ip-cooldown",
          message: `A free trial was already claimed from this connection. One trial per ${TRIAL_IP_COOLDOWN_DAYS} days.`,
          resetsAt: resetsAt.toISOString(),
        };
      }
    }

    return { available: true, reason: "ok", message: "", resetsAt: null };
  } catch (err) {
    // A limits lookup that fails must not take the trial offline; the
    // per-account unique index is still behind it.
    console.error("[trial] availability check failed:", err instanceof Error ? err.message : err);
    return { available: true, reason: "ok", message: "", resetsAt: null };
  }
}

export async function recordTrialClaim(input: {
  robotSlug: string;
  email: string;
  ipHash: string | null;
}) {
  try {
    await prisma.trialClaim.create({
      data: {
        robotSlug: input.robotSlug,
        ipHash: input.ipHash,
        emailHash: hashTrialEmail(input.email),
      },
    });
  } catch (err) {
    console.error("[trial] claim record failed:", err instanceof Error ? err.message : err);
  }
}
