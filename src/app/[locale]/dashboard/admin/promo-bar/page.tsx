import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { couponLabel, couponShowable } from "@/lib/promo-banner";
import PromoBarAdmin, { type BannerRow, type CouponOption } from "./PromoBarAdmin";

export const metadata = { title: "Promo bar" };

export default async function AdminPromoBarPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") redirect("/dashboard");

  const now = new Date();
  const [banners, coupons] = await Promise.all([
    prisma.promoBanner.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.coupon.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      take: 200,
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
    }),
  ]);

  const options: CouponOption[] = coupons
    .filter((c) => couponShowable(c, now))
    .map((c) => ({ code: c.code, label: couponLabel(c.kind, c.value) }));

  // Public-safe codes that are not in the bar yet: one click away.
  const inBar = new Set(
    banners.filter((b) => b.active && (!b.endsAt || b.endsAt > now) && b.couponCode).map((b) => b.couponCode as string),
  );
  const suggestions: CouponOption[] = options.filter((o) => !inBar.has(o.code));

  const rows: BannerRow[] = banners.map((b) => ({
    id: b.id,
    message: b.message,
    couponCode: b.couponCode,
    ctaLabel: b.ctaLabel,
    ctaHref: b.ctaHref,
    endsAt: b.endsAt?.toISOString() ?? null,
    active: b.active,
  }));

  return (
    <>
      <header style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "2.1rem", marginBottom: "0.35rem" }}>Promo bar</h1>
        <p style={{ color: "var(--text-secondary)", maxWidth: "72ch" }}>
          The strip across the top of the public site. It rotates between the live giveaway, the messages
          below (each can carry a public coupon code people can copy) and the share-your-results reward.
          The same codes are offered in the pop-up people see when they are about to leave.
          Create the coupon under Coupons first, then add it here. Free-licence codes and codes tied to
          one person cannot be shown. A message disappears by itself when its code expires or runs out.
        </p>
      </header>
      <PromoBarAdmin banners={rows} coupons={options} suggestions={suggestions} />
    </>
  );
}
