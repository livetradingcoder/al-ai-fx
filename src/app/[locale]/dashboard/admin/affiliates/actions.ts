"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") throw new Error("Admins only");
}

function refresh() {
  revalidatePath("/dashboard/admin/affiliates");
}

export async function setAffiliateStatus(affiliateId: string, suspend: boolean) {
  await requireAdmin();
  await prisma.affiliate.update({
    where: { id: affiliateId },
    data: { status: suspend ? "SUSPENDED" : "ACTIVE" },
  });
  refresh();
}

/** An override wins over the tier ladder. Passing null hands them back to it. */
export async function setAffiliateRate(affiliateId: string, rate: number | null) {
  await requireAdmin();
  if (rate !== null && (rate < 0 || rate > 100)) throw new Error("Rate must be 0–100");
  await prisma.affiliate.update({
    where: { id: affiliateId },
    data: { rateOverride: rate },
  });
  refresh();
}

/**
 * Approve everything past its hold. This is the routine action — commissions
 * sit PENDING through the refund window, then become payable in one click.
 */
export async function approveDueCommissions() {
  await requireAdmin();
  const result = await prisma.commission.updateMany({
    where: { status: "PENDING", holdUntil: { lte: new Date() } },
    data: { status: "APPROVED", approvedAt: new Date() },
  });
  refresh();
  return { approved: result.count };
}

export async function approveCommission(commissionId: string) {
  await requireAdmin();
  await prisma.commission.update({
    where: { id: commissionId },
    data: { status: "APPROVED", approvedAt: new Date() },
  });
  refresh();
}

/** Used when an order is refunded or looks fraudulent. */
export async function reverseCommission(commissionId: string, reason: string) {
  await requireAdmin();
  await prisma.commission.update({
    where: { id: commissionId },
    data: { status: "REVERSED", reversedReason: reason.slice(0, 200) || "Reversed by admin" },
  });
  refresh();
}

/** Money left the building: stamp the payout and everything it covered. */
export async function markPayoutPaid(payoutId: string, reference: string) {
  await requireAdmin();
  const now = new Date();
  await prisma.$transaction([
    prisma.affiliatePayout.update({
      where: { id: payoutId },
      data: { status: "PAID", paidAt: now, reference: reference.slice(0, 200) || null },
    }),
    prisma.commission.updateMany({
      where: { payoutId },
      data: { status: "PAID", paidAt: now },
    }),
  ]);
  refresh();
}

/** Rejecting releases the commissions so they can be requested again. */
export async function rejectPayout(payoutId: string, note: string) {
  await requireAdmin();
  await prisma.$transaction([
    prisma.affiliatePayout.update({
      where: { id: payoutId },
      data: { status: "REJECTED", adminNote: note.slice(0, 200) || null },
    }),
    prisma.commission.updateMany({ where: { payoutId }, data: { payoutId: null } }),
  ]);
  refresh();
}

export async function saveProgramSettings(input: {
  cookieDays: number;
  defaultRate: number;
  referredDiscount: number;
  minPayout: number;
  holdDays: number;
  tierBasis: "VOLUME" | "REFERRALS";
  lifetimeScope: boolean;
  blockSelfReferral: boolean;
}) {
  await requireAdmin();
  if (input.cookieDays < 1 || input.cookieDays > 365) throw new Error("Cookie days must be 1–365");
  if (input.defaultRate < 0 || input.defaultRate > 100) throw new Error("Rate must be 0–100");
  if (input.referredDiscount < 0 || input.referredDiscount > 90)
    throw new Error("Discount must be 0–90");

  await prisma.affiliateSettings.update({ where: { id: "default" }, data: input });
  refresh();
}

/** The whole ladder is saved at once — rows are meaningless in isolation. */
export async function saveTiers(tiers: { id?: string; name: string; threshold: number; rate: number }[]) {
  await requireAdmin();
  const clean = tiers
    .filter((t) => t.name.trim())
    .sort((a, b) => a.threshold - b.threshold)
    .slice(0, 10);
  if (clean.length === 0) throw new Error("Keep at least one tier");

  await prisma.$transaction([
    prisma.affiliateTier.deleteMany({}),
    prisma.affiliateTier.createMany({
      data: clean.map((t, i) => ({
        name: t.name.trim().slice(0, 40),
        threshold: Math.max(0, t.threshold),
        rate: Math.min(100, Math.max(0, t.rate)),
        sortOrder: i,
      })),
    }),
  ]);
  refresh();
}
