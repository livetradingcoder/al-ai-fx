import { randomInt } from "node:crypto";

import type { Coupon, Prisma } from "@prisma/client";

// The reward for sharing results: one single-use percentage code, tied to the
// email of the person who earned it, created only when an admin approves the
// link they submitted. It goes through the ordinary coupon path at checkout
// (validateCoupon / redeemCoupon), so the price is still resolved server-side.

export const SHARE_REWARD_PERCENT = 25;
export const SHARE_REWARD_DAYS = 30;

// No 0/O/1/I/L so a code read out of an email can be typed back.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRewardCode(rand: (max: number) => number = randomInt): string {
  let body = "";
  for (let i = 0; i < 8; i++) body += ALPHABET[rand(ALPHABET.length)];
  return `GB-${body}`;
}

export function rewardExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + SHARE_REWARD_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Creates the person's reward code inside the caller's transaction. Retries on
 * the (astronomically unlikely) chance the random code already exists.
 */
export async function createShareRewardCoupon(
  tx: Prisma.TransactionClient,
  input: { userId: string; email: string },
): Promise<Coupon> {
  const email = input.email.trim().toLowerCase();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRewardCode();
    const taken = await tx.coupon.findUnique({ where: { code }, select: { id: true } });
    if (taken) continue;
    return tx.coupon.create({
      data: {
        code,
        kind: "PERCENT",
        value: SHARE_REWARD_PERCENT,
        maxRedemptions: 1,
        oncePerEmail: true,
        restrictedEmail: email,
        expiresAt: rewardExpiry(),
        active: true,
        note: `Share reward for user ${input.userId}`,
      },
    });
  }
  throw new Error("Could not generate a unique reward code.");
}
