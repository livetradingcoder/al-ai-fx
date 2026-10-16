import { randomInt } from "node:crypto";

import type { Giveaway } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isPromoBlockedCountry } from "@/lib/promo-eligibility";

// Giveaway entries and the draw. An entry needs only an email: marketing
// consent is a separate choice and only creates/updates an EmailSubscriber row
// when the person ticked it. Bonus entries come from an approved results proof
// and an approved share (one each), granted by the admin approval actions.

export type EntrySource = "exit-intent" | "page" | "proof" | "share";

/** The giveaway people can enter right now, if any. */
export async function getLiveGiveaway(now: Date = new Date()): Promise<Giveaway | null> {
  return prisma.giveaway.findFirst({
    where: { status: "LIVE", startsAt: { lte: now }, endsAt: { gte: now } },
    orderBy: { endsAt: "asc" },
  });
}

export type EnterResult =
  | { ok: true; created: boolean }
  | { ok: false; error: string };

export async function enterGiveaway(input: {
  giveaway: Pick<Giveaway, "id" | "slug">;
  email: string;
  userId?: string | null;
  source: EntrySource;
  marketingOptIn: boolean;
  country: string | null;
  locale: string | null;
}): Promise<EnterResult> {
  const email = input.email.trim().toLowerCase();

  const existing = await prisma.giveawayEntry.findUnique({
    where: { giveawayId_email: { giveawayId: input.giveaway.id, email } },
    select: { id: true, marketingOptIn: true },
  });

  if (existing) {
    // Entering again never loses a choice already made; ticking the box now adds it.
    if (input.marketingOptIn && !existing.marketingOptIn) {
      await prisma.giveawayEntry.update({ where: { id: existing.id }, data: { marketingOptIn: true } });
    }
  } else {
    await prisma.giveawayEntry.create({
      data: {
        giveawayId: input.giveaway.id,
        email,
        userId: input.userId ?? null,
        source: input.source,
        marketingOptIn: input.marketingOptIn,
        country: input.country,
        locale: input.locale,
      },
    });
  }

  if (input.marketingOptIn) {
    await prisma.emailSubscriber.upsert({
      where: { email },
      create: { email, source: `giveaway:${input.giveaway.slug}`.slice(0, 64), locale: input.locale },
      // Ticking the box here is an explicit resubscribe.
      update: { unsubscribedAt: null, ...(input.locale ? { locale: input.locale } : {}) },
    });
  }

  return { ok: true, created: !existing };
}

/**
 * Adds one bonus entry for a person, creating their entry if they have none.
 * Called once per approved proof and once per approved share.
 */
export async function grantBonusEntry(input: {
  email: string;
  userId: string;
  source: Extract<EntrySource, "proof" | "share">;
  country: string | null;
}): Promise<void> {
  const giveaway = await getLiveGiveaway();
  if (!giveaway) return;
  const email = input.email.trim().toLowerCase();
  await prisma.giveawayEntry.upsert({
    where: { giveawayId_email: { giveawayId: giveaway.id, email } },
    create: {
      giveawayId: giveaway.id,
      email,
      userId: input.userId,
      source: input.source,
      bonusEntries: 1,
      country: input.country,
    },
    update: { bonusEntries: { increment: 1 }, userId: input.userId },
  });
}

export type DrawEntry = { id: string; weight: number };

/** Picks one entry at random, each weighted by its number of chances. Null when there is nothing to pick. */
export function pickWinner(entries: DrawEntry[], rand: (max: number) => number = randomInt): string | null {
  const pool = entries.filter((e) => e.weight > 0);
  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  if (total <= 0) return null;
  let ticket = rand(total);
  for (const e of pool) {
    if (ticket < e.weight) return e.id;
    ticket -= e.weight;
  }
  return null;
}

/** Entries that may win: not from a restricted country (the list may have changed since they entered). */
export function drawableEntries(
  entries: { id: string; bonusEntries: number; country: string | null }[],
): DrawEntry[] {
  return entries
    .filter((e) => !isPromoBlockedCountry(e.country))
    .map((e) => ({ id: e.id, weight: 1 + Math.max(0, e.bonusEntries) }));
}
