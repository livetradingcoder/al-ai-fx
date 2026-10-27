import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// A log of payment attempts for the admin Orders page. An Order is written only
// once money has arrived, so a buyer who opened the payment page and left, or
// whose checkout could not even start, would otherwise leave no trace at all.
//
// Nothing here may ever throw into the checkout that called it: a logging
// problem must not be able to stop a sale. Before the table exists (the
// migration is applied by hand in production) every call is a quiet no-op.

export type AttemptStatus = "STARTED" | "PAID" | "FAILED" | "CANCELED" | "ERROR";
export type AttemptProvider = "whop" | "oxapay" | "polar";

/** A checkout still open after this long is shown as abandoned. */
export const ABANDONED_AFTER_MS = 30 * 60 * 1000;
const DETAIL_CHARS = 300;

export type AttemptBase = {
  provider: AttemptProvider;
  email: string;
  robotSlug: string;
  tier: string;
  amount?: number | null;
  couponCode?: string | null;
};

/** The label an admin reads: an open checkout becomes IN PROGRESS, then ABANDONED. */
export function displayStatus(status: string, createdAt: Date, now: Date = new Date()): string {
  if (status !== "STARTED") return status;
  return now.getTime() - createdAt.getTime() > ABANDONED_AFTER_MS ? "ABANDONED" : "IN PROGRESS";
}

let warnedMissingTable = false;
async function safely(label: string, run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
      if (!warnedMissingTable) {
        warnedMissingTable = true;
        console.warn("[PaymentAttempt] table missing — run `prisma migrate deploy`; attempts are not being logged");
      }
      return;
    }
    console.error(`[PaymentAttempt] ${label} failed:`, err);
  }
}

const clip = (text: string | undefined) => (text ? text.slice(0, DETAIL_CHARS) : null);

/** A checkout session now exists and the buyer is on their way to the payment page. */
export function recordAttemptStarted(input: AttemptBase & { orderRef: string }): Promise<void> {
  return safely("start", () =>
    prisma.paymentAttempt.upsert({
      where: { orderRef: input.orderRef },
      create: {
        orderRef: input.orderRef,
        provider: input.provider,
        email: input.email,
        robotSlug: input.robotSlug,
        tier: input.tier,
        amount: input.amount ?? null,
        couponCode: input.couponCode ?? null,
        status: "STARTED",
      },
      update: {},
    }),
  );
}

/** The buyer pressed pay but no checkout could be created; `detail` says why. */
export function recordAttemptError(input: AttemptBase & { detail: string }): Promise<void> {
  return safely("error", () =>
    prisma.paymentAttempt.create({
      data: {
        provider: input.provider,
        email: input.email,
        robotSlug: input.robotSlug,
        tier: input.tier,
        amount: input.amount ?? null,
        couponCode: input.couponCode ?? null,
        status: "ERROR",
        detail: clip(input.detail),
      },
    }),
  );
}

/** Money arrived: called wherever an order is written, whichever provider it came from. */
export function markAttemptPaid(orderRef: string): Promise<void> {
  return safely("paid", () =>
    prisma.paymentAttempt.updateMany({
      where: { orderRef, status: { not: "PAID" } },
      data: { status: "PAID", detail: null },
    }),
  );
}

/** The provider sent the buyer back unpaid. Only an open attempt moves: a paid one never goes backwards. */
export function markAttemptOutcome(
  orderRef: string,
  outcome: "FAILED" | "CANCELED",
  detail?: string,
): Promise<void> {
  return safely("outcome", () =>
    prisma.paymentAttempt.updateMany({
      where: { orderRef, status: "STARTED" },
      data: { status: outcome, detail: clip(detail) },
    }),
  );
}

export type UnpaidAttempt = {
  id: string;
  provider: string;
  email: string;
  robotSlug: string;
  tier: string;
  amount: number | null;
  orderRef: string | null;
  status: string;
  detail: string | null;
  createdAt: Date;
};

/** Attempts that did not end in a payment, newest first. Empty if the table is not there yet. */
export async function loadUnpaidAttempts(take = 500): Promise<UnpaidAttempt[]> {
  try {
    return await prisma.paymentAttempt.findMany({
      where: { status: { not: "PAID" } },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true, provider: true, email: true, robotSlug: true, tier: true,
        amount: true, orderRef: true, status: true, detail: true, createdAt: true,
      },
    });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021")) {
      console.error("[PaymentAttempt] load failed:", err);
    }
    return [];
  }
}
