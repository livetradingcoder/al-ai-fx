"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureAffiliate, getSettings } from "@/lib/affiliate";
import type { ActionResult } from "@/lib/action-result";

async function signedInUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

/** Joining is instant — there is nothing to review before someone shares a link. */
export async function joinProgram(): Promise<ActionResult> {
  const userId = await signedInUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  await ensureAffiliate(userId);
  revalidatePath("/dashboard/affiliate");
  // No message: the page swaps the join card for the dashboard.
  return { ok: true, message: "" };
}

export async function savePayoutDetails(method: string, address: string): Promise<ActionResult> {
  const userId = await signedInUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  const affiliate = await prisma.affiliate.findUnique({ where: { userId } });
  if (!affiliate) return { ok: false, error: "You are not in the program yet" };

  await prisma.affiliate.update({
    where: { id: affiliate.id },
    data: {
      payoutMethod: method.trim().slice(0, 60) || null,
      payoutAddress: address.trim().slice(0, 200) || null,
    },
  });
  revalidatePath("/dashboard/affiliate");
  return { ok: true, message: "Payout details saved." };
}

/** Rolls back a payout whose commissions another request claimed first. */
class CommissionsAlreadyClaimed extends Error {
  constructor() {
    super("Commissions were claimed by a concurrent payout request");
    this.name = "CommissionsAlreadyClaimed";
  }
}

// Both an empty balance and a request that lost the race for its commissions.
const NOTHING_TO_PAY = "Nothing to pay out";

/**
 * Turn approved commissions into a payout request.
 *
 * Only APPROVED rows count — anything still inside the refund hold is not
 * money yet. Two requests can run at once (two tabs, a replayed POST) and
 * both read the same rows, so the UPDATE that claims them only matches
 * commissions that are still APPROVED and unclaimed. Postgres re-checks that
 * WHERE after waiting for the other request to commit, so the loser claims
 * fewer rows than it read, rolls back its payout and gets "Nothing to pay out".
 *
 * The minimum applies to what this request claims, not to the APPROVED
 * balance: commissions in a REQUESTED payout stay APPROVED until it is marked
 * paid, so that balance still counts money that has already been requested.
 */
export async function requestPayout(): Promise<ActionResult> {
  const userId = await signedInUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  const affiliate = await prisma.affiliate.findUnique({ where: { userId } });
  if (!affiliate) return { ok: false, error: "You are not in the program yet" };
  if (affiliate.status !== "ACTIVE") {
    return { ok: false, error: "Your affiliate account is suspended" };
  }
  if (!affiliate.payoutAddress) return { ok: false, error: "Add your payout details first" };

  const settings = await getSettings();

  const result = await prisma.$transaction(async (tx): Promise<ActionResult> => {
    const payable = await tx.commission.findMany({
      where: { affiliateId: affiliate.id, status: "APPROVED", payoutId: null },
      select: { id: true, amount: true },
    });
    if (payable.length === 0) return { ok: false, error: NOTHING_TO_PAY };

    const amount = Math.round(payable.reduce((sum, c) => sum + c.amount, 0) * 100) / 100;
    if (amount < settings.minPayout) {
      return { ok: false, error: `You need at least $${settings.minPayout} approved to request a payout` };
    }

    const created = await tx.affiliatePayout.create({
      data: {
        affiliateId: affiliate.id,
        amount,
        method: affiliate.payoutMethod,
        address: affiliate.payoutAddress,
      },
    });
    const claimed = await tx.commission.updateMany({
      where: { id: { in: payable.map((c) => c.id) }, status: "APPROVED", payoutId: null },
      data: { payoutId: created.id },
    });
    if (claimed.count !== payable.length) throw new CommissionsAlreadyClaimed();
    return { ok: true, message: `Payout of $${created.amount.toFixed(2)} requested.` };
  }).catch((err: unknown): ActionResult => {
    if (err instanceof CommissionsAlreadyClaimed) return { ok: false, error: NOTHING_TO_PAY };
    throw err;
  });

  if (result.ok) revalidatePath("/dashboard/affiliate");
  return result;
}
