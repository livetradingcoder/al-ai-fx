"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/action-result";

// The settings form saves the rules and then the ladder, showing whichever
// reply comes last; both change what new commissions earn.
const PROGRAMME_SAVED = "Programme updated. New rates apply to commissions from now on.";

/** Null for an admin, otherwise the failure to hand straight back. */
async function requireAdmin(): Promise<ActionResult | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.role === "ADMIN" ? null : { ok: false, error: "Admins only" };
}

function refresh() {
  revalidatePath("/dashboard/admin/affiliates");
}

export async function setAffiliateStatus(affiliateId: string, suspend: boolean): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const affiliate = await prisma.affiliate.update({
    where: { id: affiliateId },
    data: { status: suspend ? "SUSPENDED" : "ACTIVE" },
    select: { user: { select: { email: true } } },
  });
  refresh();
  const { email } = affiliate.user;
  return {
    ok: true,
    message: suspend ? `${email} suspended — their links stop attributing.` : `${email} reinstated.`,
  };
}

/** An override wins over the tier ladder. Passing null hands them back to it. */
export async function setAffiliateRate(affiliateId: string, rate: number | null): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (rate !== null && (rate < 0 || rate > 100)) return { ok: false, error: "Rate must be 0–100" };
  const affiliate = await prisma.affiliate.update({
    where: { id: affiliateId },
    data: { rateOverride: rate },
    select: { user: { select: { email: true } } },
  });
  refresh();
  return {
    ok: true,
    message: `${affiliate.user.email} now earns ${rate === null ? "the tier rate" : `${rate}%`}.`,
  };
}

/**
 * Approve everything past its hold. This is the routine action — commissions
 * sit PENDING through the refund window, then become payable in one click.
 */
export async function approveDueCommissions(): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const result = await prisma.commission.updateMany({
    where: { status: "PENDING", holdUntil: { lte: new Date() } },
    data: { status: "APPROVED", approvedAt: new Date() },
  });
  refresh();
  return {
    ok: true,
    message: `${result.count} commission${result.count === 1 ? "" : "s"} approved.`,
  };
}

export async function approveCommission(commissionId: string): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  await prisma.commission.update({
    where: { id: commissionId },
    data: { status: "APPROVED", approvedAt: new Date() },
  });
  refresh();
  return { ok: true, message: "Approved." };
}

/** Used when an order is refunded or looks fraudulent. */
export async function reverseCommission(commissionId: string, reason: string): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  await prisma.commission.update({
    where: { id: commissionId },
    data: { status: "REVERSED", reversedReason: reason.slice(0, 200) || "Reversed by admin" },
  });
  refresh();
  return { ok: true, message: "Reversed." };
}

/** Money left the building: stamp the payout and everything it covered. */
export async function markPayoutPaid(payoutId: string, reference: string): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const now = new Date();
  const [payout] = await prisma.$transaction([
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
  return { ok: true, message: `Marked $${payout.amount.toFixed(2)} as paid.` };
}

/** Rejecting releases the commissions so they can be requested again. */
export async function rejectPayout(payoutId: string, note: string): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  await prisma.$transaction([
    prisma.affiliatePayout.update({
      where: { id: payoutId },
      data: { status: "REJECTED", adminNote: note.slice(0, 200) || null },
    }),
    prisma.commission.updateMany({ where: { payoutId }, data: { payoutId: null } }),
  ]);
  refresh();
  return { ok: true, message: "Rejected — the commissions are payable again." };
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
}): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (input.cookieDays < 1 || input.cookieDays > 365) {
    return { ok: false, error: "Cookie days must be 1–365" };
  }
  if (input.defaultRate < 0 || input.defaultRate > 100) {
    return { ok: false, error: "Rate must be 0–100" };
  }
  if (input.referredDiscount < 0 || input.referredDiscount > 90) {
    return { ok: false, error: "Discount must be 0–90" };
  }

  await prisma.affiliateSettings.update({ where: { id: "default" }, data: input });
  refresh();
  return { ok: true, message: PROGRAMME_SAVED };
}

/** The whole ladder is saved at once — rows are meaningless in isolation. */
export async function saveTiers(
  tiers: { id?: string; name: string; threshold: number; rate: number }[],
): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const clean = tiers
    .filter((t) => t.name.trim())
    .sort((a, b) => a.threshold - b.threshold)
    .slice(0, 10);
  if (clean.length === 0) return { ok: false, error: "Keep at least one tier" };

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
  return { ok: true, message: PROGRAMME_SAVED };
}
