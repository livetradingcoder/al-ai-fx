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

/** Rolls back a reversal whose commission changed after it was read. */
class CommissionChanged extends Error {
  constructor() {
    super("Commission changed while it was being reversed");
    this.name = "CommissionChanged";
  }
}

const COMMISSION_CHANGED = "This commission changed while it was being reversed. Check it and try again.";

/**
 * Used when an order is refunded or looks fraudulent.
 *
 * A commission stays APPROVED inside a REQUESTED payout until the payout is
 * marked paid, and markPayoutPaid pays whatever the payout still holds at its
 * stored amount. So reversing one also takes it out of its payout and resets
 * the amount to what is left, which the admin sees before sending the money;
 * a payout left with nothing is rejected.
 *
 * The payout row is locked before the commission is written. markPayoutPaid
 * and rejectPayout also write the payout first, so a reversal that races
 * either one waits for it and then finds the payout closed. Only PENDING and
 * APPROVED commissions can be reversed, so a stale page cannot reverse a paid one.
 */
export async function reverseCommission(commissionId: string, reason: string): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const result = await prisma.$transaction(async (tx): Promise<ActionResult> => {
    const commission = await tx.commission.findUnique({
      where: { id: commissionId },
      select: { status: true, payoutId: true },
    });
    if (!commission) return { ok: false, error: "Commission not found" };
    if (commission.status !== "PENDING" && commission.status !== "APPROVED") {
      return { ok: false, error: `This commission is already ${commission.status.toLowerCase()}` };
    }
    const { payoutId } = commission;

    if (payoutId) {
      const open = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "AffiliatePayout"
        WHERE id = ${payoutId} AND status = 'REQUESTED'
        FOR UPDATE
      `;
      if (open.length === 0) return { ok: false, error: COMMISSION_CHANGED };
    }

    const reversed = await tx.commission.updateMany({
      where: { id: commissionId, status: { in: ["PENDING", "APPROVED"] }, payoutId },
      data: {
        status: "REVERSED",
        reversedReason: reason.slice(0, 200) || "Reversed by admin",
        payoutId: null,
      },
    });
    if (reversed.count !== 1) throw new CommissionChanged();
    if (!payoutId) return { ok: true, message: "Reversed." };

    const left = await tx.commission.findMany({ where: { payoutId }, select: { amount: true } });
    const amount = Math.round(left.reduce((sum, c) => sum + c.amount, 0) * 100) / 100;
    if (left.length > 0) {
      await tx.affiliatePayout.update({ where: { id: payoutId }, data: { amount } });
      return { ok: true, message: `Reversed. Its payout request is now $${amount.toFixed(2)}.` };
    }
    await tx.affiliatePayout.update({
      where: { id: payoutId },
      data: { amount, status: "REJECTED", adminNote: "Every commission in it was reversed" },
    });
    return { ok: true, message: "Reversed. Its payout request had nothing else in it and is now rejected." };
  }).catch((err: unknown): ActionResult => {
    if (err instanceof CommissionChanged) return { ok: false, error: COMMISSION_CHANGED };
    throw err;
  });

  // A refusal from the transaction means the page was out of date, so refresh either way.
  refresh();
  return result;
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
