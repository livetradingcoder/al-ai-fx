import { Prisma, type PricingTier } from "@prisma/client";
import { markAttemptPaid } from "@/lib/payment-attempts";
import { prisma } from "@/lib/prisma";

// Moving a licence to a different MT5 account. A build is compiled for one
// account number, so each move costs a new compile and is how a licence gets
// shared. Policy: every user gets ONE free change. After that, each change is
// paid for: half the price of the plan being moved.
//
// First-time linking is not a change. Re-linking the account a licence already
// has is not a change either (that is how "compile again" works).

export const FREE_CHANGES_PER_USER = 1;
/** The fee is this share of the plan price. */
export const CHANGE_FEE_SHARE = 0.5;
/** Whop will not take less than $1 for a fiat payment. */
export const MIN_CHANGE_FEE = 1;
/** The `tier` the fee payment travels under, through checkout and the webhooks. */
export const ACCOUNT_CHANGE_TIER = "account-change";

export const MT5_CHANGE_LIMIT_MESSAGE =
  "You have used the one MT5 account change that is included. Another change costs half of your plan's price.";

type Db = Prisma.TransactionClient | typeof prisma;

/** What changing costs for a plan that costs `planPrice`, in USD. */
export function changeFee(planPrice: number): number {
  const half = Math.round(planPrice * CHANGE_FEE_SHARE * 100) / 100;
  return Math.max(MIN_CHANGE_FEE, half);
}

export type ChangeAllowance =
  | { kind: "free" }
  | { kind: "credit"; creditId: string }
  | { kind: "payment" };

/** How this licence's next change would be covered: the free one, a paid credit, or not at all yet. */
export async function changeAllowance(
  db: Db,
  input: { userId: string; subscriptionId: string },
): Promise<ChangeAllowance> {
  const freeUsed = await db.mt5AccountChange.count({ where: { userId: input.userId, creditId: null } });
  if (freeUsed < FREE_CHANGES_PER_USER) return { kind: "free" };
  const credit = await db.mt5ChangeCredit.findFirst({
    where: { userId: input.userId, subscriptionId: input.subscriptionId, change: { is: null } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return credit ? { kind: "credit", creditId: credit.id } : { kind: "payment" };
}

export type ChangeQuote = { allowance: "free" | "credit" | "payment"; fee: number | null };

/** For the dashboard and the checkout: what the next change on this licence involves. */
export async function quoteChange(
  userId: string,
  sub: { id: string; robotId: string; tier: PricingTier },
): Promise<ChangeQuote> {
  try {
    const allowance = await changeAllowance(prisma, { userId, subscriptionId: sub.id });
    if (allowance.kind !== "payment") return { allowance: allowance.kind, fee: null };
    // The plan's price as listed now; inactive or retired prices still quote.
    const price = await prisma.robotPrice.findUnique({
      where: { robotId_tier: { robotId: sub.robotId, tier: sub.tier } },
      select: { amount: true },
    });
    return { allowance: "payment", fee: price ? changeFee(price.amount) : null };
  } catch (err) {
    // The tables are not there yet (migration pending): behave as before the limit.
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2021" || err.code === "P2022")) {
      return { allowance: "free", fee: null };
    }
    throw err;
  }
}

/**
 * A fee payment arrived (from either payment webhook): record the order and
 * the credit it buys. Safe to call twice for one payment: the order reference
 * is unique on both rows.
 */
export async function grantChangeCredit(input: {
  email: string;
  subscriptionId: string | null;
  orderRef: string;
  amount: number;
  currency: string;
}) {
  const user = await prisma.user.findFirst({
    where: { email: { equals: input.email, mode: "insensitive" } },
    select: { id: true },
  });
  const sub = input.subscriptionId
    ? await prisma.subscription.findUnique({
        where: { id: input.subscriptionId },
        select: { id: true, userId: true, tier: true },
      })
    : null;
  if (!user || !sub || sub.userId !== user.id) {
    throw new Error(`account change payment ${input.orderRef} does not match a licence of ${input.email}`);
  }

  const existing = await prisma.order.findUnique({ where: { paygateId: input.orderRef }, select: { id: true } });
  if (existing) return { userId: user.id, orderId: existing.id, duplicated: true };

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        userId: user.id,
        amount: input.amount,
        currency: input.currency,
        status: "SUCCESS",
        paygateId: input.orderRef,
        // The order table has no tier for a fee: it carries the licence's, and the
        // admin list labels it by its credit.
        pricingTier: sub.tier,
      },
    });
    await tx.mt5ChangeCredit.create({
      data: {
        userId: user.id,
        subscriptionId: sub.id,
        orderRef: input.orderRef,
        amount: input.amount,
        currency: input.currency,
      },
    });
    return created;
  });
  await markAttemptPaid(input.orderRef);
  return { userId: user.id, orderId: order.id, duplicated: false };
}

/** Order references that were MT5 change fees, so the admin can label them. */
export async function changeFeeOrderRefs(orderRefs: string[]): Promise<Set<string>> {
  if (orderRefs.length === 0) return new Set();
  try {
    const rows = await prisma.mt5ChangeCredit.findMany({
      where: { orderRef: { in: orderRefs } },
      select: { orderRef: true },
    });
    return new Set(rows.map((r) => r.orderRef));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2021" || err.code === "P2022")) {
      return new Set();
    }
    throw err;
  }
}
