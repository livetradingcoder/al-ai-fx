"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { affiliateBalance, ensureAffiliate, getSettings } from "@/lib/affiliate";

async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Not signed in");
  return session.user.id;
}

/** Joining is instant — there is nothing to review before someone shares a link. */
export async function joinProgram() {
  const userId = await requireUser();
  const affiliate = await ensureAffiliate(userId);
  revalidatePath("/dashboard/affiliate");
  return { code: affiliate.code };
}

export async function savePayoutDetails(method: string, address: string) {
  const userId = await requireUser();
  const affiliate = await prisma.affiliate.findUnique({ where: { userId } });
  if (!affiliate) throw new Error("You are not in the program yet");

  await prisma.affiliate.update({
    where: { id: affiliate.id },
    data: {
      payoutMethod: method.trim().slice(0, 60) || null,
      payoutAddress: address.trim().slice(0, 200) || null,
    },
  });
  revalidatePath("/dashboard/affiliate");
}

/**
 * Turn approved commissions into a payout request.
 *
 * Only APPROVED rows count — anything still inside the refund hold is not
 * money yet. The commissions are stamped with the payout id in the same
 * transaction, so a double-click cannot request the same balance twice.
 */
export async function requestPayout() {
  const userId = await requireUser();
  const affiliate = await prisma.affiliate.findUnique({ where: { userId } });
  if (!affiliate) throw new Error("You are not in the program yet");
  if (affiliate.status !== "ACTIVE") throw new Error("Your affiliate account is suspended");
  if (!affiliate.payoutAddress) throw new Error("Add your payout details first");

  const settings = await getSettings();
  const balance = await affiliateBalance(affiliate.id);
  if (balance.approved < settings.minPayout) {
    throw new Error(`You need at least $${settings.minPayout} approved to request a payout`);
  }

  const payout = await prisma.$transaction(async (tx) => {
    const payable = await tx.commission.findMany({
      where: { affiliateId: affiliate.id, status: "APPROVED", payoutId: null },
      select: { id: true, amount: true },
    });
    if (payable.length === 0) throw new Error("Nothing to pay out");

    const amount = Math.round(payable.reduce((sum, c) => sum + c.amount, 0) * 100) / 100;
    const created = await tx.affiliatePayout.create({
      data: {
        affiliateId: affiliate.id,
        amount,
        method: affiliate.payoutMethod,
        address: affiliate.payoutAddress,
      },
    });
    await tx.commission.updateMany({
      where: { id: { in: payable.map((c) => c.id) } },
      data: { payoutId: created.id },
    });
    return created;
  });

  revalidatePath("/dashboard/affiliate");
  return { amount: payout.amount };
}
