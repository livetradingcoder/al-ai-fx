import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

// One free trial per MT5 account. A licence is locked to the MT5 account it is
// built for, so the account number is what a trial is really worth to someone
// farming them: make an account that has been used with any licence - trial or
// paid, theirs or anyone's - ineligible for a new trial, and a fresh email
// address alone gets them nothing. (A fresh demo account still does; see
// the notes in the commit. This closes the cheap loophole, not every one.)
//
// Every link is recorded in Mt5AccountUse and never removed, so changing the
// account on a trial, or deleting a person, doesn't free the old number up.

export const MT5_ACCOUNT_USED_MESSAGE =
  "This MT5 account has already been used with a GoldBot licence, so it can't be used for a free trial. " +
  "Link a different MT5 account, choose a plan to use this one, or contact support@al-ai-fx.xyz if you think this is a mistake.";

export type LinkOutcome = { ok: true } | { ok: false; reason: "account-used" };

/**
 * Links an MT5 account to a licence, enforcing the trial rule.
 *
 *  - A free trial is refused an account that appears on any OTHER licence's
 *    history, unless the trial itself linked it first: it can always go back to
 *    or re-link an account it has already used.
 *  - A paid licence may link any account, including one that had a trial: that
 *    is how a trial turns into a purchase.
 *
 * The check and the write happen under a per-account lock, so two trials
 * racing for the same new account can't both get it.
 */
export async function linkMt5Account(input: {
  subscriptionId: string;
  userId: string;
  tier: string;
  accountNumber: string;
}): Promise<LinkOutcome> {
  const { subscriptionId, userId, tier, accountNumber } = input;

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${accountNumber}::text))`;

      if (tier === "FREE_TRIAL") {
        // A trial keeps the account it already linked, even if a paid licence
        // has used it since: the rule is about taking an account someone else
        // has had, not about re-linking your own.
        const own = await tx.mt5AccountUse.findUnique({
          where: { subscriptionId_accountNumber: { subscriptionId, accountNumber } },
          select: { id: true },
        });
        if (!own) {
          const used = await tx.mt5AccountUse.findFirst({
            where: { accountNumber, subscriptionId: { not: subscriptionId } },
            select: { id: true },
          });
          if (used) return { ok: false, reason: "account-used" } as const;
        }
      }

      await tx.subscription.update({ where: { id: subscriptionId }, data: { mt5AccountNumber: accountNumber } });
      await tx.mt5AccountUse.upsert({
        where: { subscriptionId_accountNumber: { subscriptionId, accountNumber } },
        update: {},
        create: { accountNumber, userId, subscriptionId, tier },
      });
      return { ok: true } as const;
    });
  } catch (err) {
    // The history table isn't there yet (the migration has not run). Linking an
    // account is the product's main action: it must keep working, just
    // without the check, until the migration is applied.
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2021" || err.code === "P2022")) {
      console.error("[trial-abuse] account history is missing, linking without the check:", err.message);
      await prisma.subscription.update({ where: { id: subscriptionId }, data: { mt5AccountNumber: accountNumber } });
      return { ok: true };
    }
    throw err;
  }
}

/**
 * For each MT5 account, how many licences have ever used it. The admin
 * licences page flags accounts shared by more than one. Empty when the history
 * table doesn't exist yet.
 */
export async function licencesPerAccount(accountNumbers: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (accountNumbers.length === 0) return counts;
  try {
    const rows = await prisma.mt5AccountUse.groupBy({
      by: ["accountNumber"],
      where: { accountNumber: { in: [...new Set(accountNumbers)] } },
      _count: { _all: true },
    });
    for (const row of rows) counts.set(row.accountNumber, row._count._all);
  } catch (err) {
    console.error("[trial-abuse] could not count licences per account:", err instanceof Error ? err.message : err);
  }
  return counts;
}

/** How many licences have used this account (what "Allow this account" would clear). */
export async function accountHistoryCount(accountNumber: string): Promise<number> {
  return prisma.mt5AccountUse.count({ where: { accountNumber } });
}

/**
 * Lets an MT5 account start a free trial again by forgetting its history, for
 * when an admin decides a refusal was a mistake. The licences that used it keep
 * working; only the memory that makes a trial refuse it is cleared. Returns
 * how many history rows went.
 */
export async function clearAccountHistory(accountNumber: string): Promise<number> {
  return (await prisma.mt5AccountUse.deleteMany({ where: { accountNumber } })).count;
}
