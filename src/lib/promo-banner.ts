import { prisma } from "@/lib/prisma";
import { rewardCheckoutPath } from "@/lib/reward-links";

// What the top bar shows besides the giveaway: admin-written messages, each
// optionally carrying a coupon code to copy. Only codes that are meant to be
// public ever leave the server: never a free-licence code, never a code tied
// to one person, and never one that is switched off, expired or used up.

export type PublicBanner = {
  id: string;
  message: string;
  code: string | null;
  /** "25% off" or "$5 off" for the code, when there is one. */
  label: string | null;
  ctaLabel: string;
  ctaHref: string;
  endsAt: string | null;
};

export function couponLabel(kind: string, value: number): string {
  if (kind === "PERCENT") return `${value}% off`;
  if (kind === "FIXED") return `$${value} off`;
  return "";
}

type CouponFacts = {
  kind: string;
  active: boolean;
  expiresAt: Date | null;
  maxRedemptions: number | null;
  redeemedCount: number;
  restrictedEmail: string | null;
};

/** True when a coupon is safe and sensible to show to the whole public. */
export function couponShowable(c: CouponFacts, now: Date = new Date()): boolean {
  if (!c.active) return false;
  if (c.kind === "FREE") return false; // a free code skips payment: never advertise one
  if (c.restrictedEmail) return false; // belongs to one person
  if (c.expiresAt && c.expiresAt.getTime() <= now.getTime()) return false;
  if (c.maxRedemptions != null && c.redeemedCount >= c.maxRedemptions) return false;
  return true;
}

/** A link target that stays on this site: starts with one "/", no scheme, no backslashes. */
export function safeSitePath(path: string | null | undefined, fallback: string): string {
  const p = (path ?? "").trim();
  if (!p.startsWith("/") || p.startsWith("//") || p.includes("\\") || /[\u0000-\u001f]/.test(p) || p.length > 200) {
    return fallback;
  }
  return p;
}

export async function activeBanners(now: Date = new Date()): Promise<PublicBanner[]> {
  const rows = await prisma.promoBanner.findMany({
    where: { active: true, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const out: PublicBanner[] = [];
  for (const row of rows) {
    let code: string | null = null;
    let label: string | null = null;
    let endsAt = row.endsAt;

    if (row.couponCode) {
      const coupon = await prisma.coupon.findUnique({
        where: { code: row.couponCode },
        select: {
          code: true,
          kind: true,
          value: true,
          active: true,
          expiresAt: true,
          maxRedemptions: true,
          redeemedCount: true,
          restrictedEmail: true,
        },
      });
      // A banner about a code that no longer works would be a broken promise.
      if (!coupon || !couponShowable(coupon, now)) continue;
      code = coupon.code;
      label = couponLabel(coupon.kind, coupon.value) || null;
      endsAt = endsAt ?? coupon.expiresAt;
    }

    out.push({
      id: row.id,
      message: row.message,
      code,
      label,
      ctaLabel: row.ctaLabel?.trim() || (code ? "Use code" : "Learn more"),
      ctaHref: safeSitePath(row.ctaHref, code ? rewardCheckoutPath(code) : "/catalog"),
      endsAt: endsAt ? endsAt.toISOString() : null,
    });
  }
  return out;
}
