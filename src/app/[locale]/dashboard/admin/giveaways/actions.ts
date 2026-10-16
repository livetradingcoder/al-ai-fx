"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import type { ActionResult } from "@/lib/action-result";
import { authOptions } from "@/lib/auth";
import { drawableEntries, pickWinner } from "@/lib/giveaway";
import { prisma } from "@/lib/prisma";

async function requireAdmin(): Promise<ActionResult | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.role === "ADMIN" ? null : { ok: false, error: "Admins only" };
}

function refresh() {
  revalidatePath("/dashboard/admin/giveaways");
  revalidatePath("/giveaway");
}

export async function saveGiveaway(input: {
  id: string | null;
  slug: string;
  title: string;
  prize: string;
  rulesText: string;
  startsAt: string;
  endsAt: string;
  live: boolean;
}): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const slug = input.slug.trim().toLowerCase();
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return { ok: false, error: "Slug: 3–40 letters, numbers or dashes" };
  const title = input.title.trim();
  const prize = input.prize.trim();
  const rulesText = input.rulesText.trim();
  if (!title || title.length > 100) return { ok: false, error: "Add a title (up to 100 characters)" };
  if (!prize || prize.length > 200) return { ok: false, error: "Describe the prize (up to 200 characters)" };
  if (rulesText.length < 40 || rulesText.length > 6000) {
    return { ok: false, error: "The rules need 40–6000 characters: who can enter, how the winner is picked, when" };
  }

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return { ok: false, error: "Check the dates" };
  if (endsAt <= startsAt) return { ok: false, error: "The end must be after the start" };

  const existing = input.id ? await prisma.giveaway.findUnique({ where: { id: input.id } }) : null;
  if (input.id && !existing) return { ok: false, error: "That giveaway no longer exists" };
  if (existing?.status === "DRAWN") return { ok: false, error: "A drawn giveaway cannot be edited" };

  const clash = await prisma.giveaway.findUnique({ where: { slug } });
  if (clash && clash.id !== input.id) return { ok: false, error: `${slug} is already used` };

  if (input.live) {
    const other = await prisma.giveaway.findFirst({
      where: { status: "LIVE", ...(input.id ? { id: { not: input.id } } : {}) },
      select: { title: true },
    });
    if (other) return { ok: false, error: `“${other.title}” is already live. Switch it off first.` };
  }

  const data = { slug, title, prize, rulesText, startsAt, endsAt, status: input.live ? ("LIVE" as const) : ("DRAFT" as const) };
  if (existing) await prisma.giveaway.update({ where: { id: existing.id }, data });
  else await prisma.giveaway.create({ data });

  refresh();
  return { ok: true, message: input.live ? "Saved and live." : "Saved as a draft." };
}

export async function setGiveawayLive(input: { id: string; live: boolean }): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const giveaway = await prisma.giveaway.findUnique({ where: { id: input.id } });
  if (!giveaway) return { ok: false, error: "That giveaway no longer exists" };
  if (giveaway.status === "DRAWN") return { ok: false, error: "A drawn giveaway cannot be changed" };

  if (input.live) {
    const other = await prisma.giveaway.findFirst({
      where: { status: "LIVE", id: { not: giveaway.id } },
      select: { title: true },
    });
    if (other) return { ok: false, error: `“${other.title}” is already live. Switch it off first.` };
  }

  await prisma.giveaway.update({ where: { id: giveaway.id }, data: { status: input.live ? "LIVE" : "DRAFT" } });
  refresh();
  return { ok: true, message: input.live ? "Giveaway is live." : "Giveaway switched off." };
}

export async function drawGiveawayWinner(input: { id: string }): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const giveaway = await prisma.giveaway.findUnique({ where: { id: input.id } });
  if (!giveaway) return { ok: false, error: "That giveaway no longer exists" };
  if (giveaway.status === "DRAWN") return { ok: false, error: "The winner has already been drawn" };
  if (giveaway.endsAt.getTime() > Date.now()) {
    return { ok: false, error: "The giveaway has not ended yet. Draw after the closing date." };
  }

  const entries = await prisma.giveawayEntry.findMany({
    where: { giveawayId: giveaway.id },
    select: { id: true, email: true, bonusEntries: true, country: true },
  });
  const winnerId = pickWinner(drawableEntries(entries));
  if (!winnerId) return { ok: false, error: "There are no eligible entries to draw from" };
  const winner = entries.find((e) => e.id === winnerId)!;

  // Guarded so a double click cannot draw twice and replace the winner.
  const marked = await prisma.giveaway.updateMany({
    where: { id: giveaway.id, status: { not: "DRAWN" } },
    data: { status: "DRAWN", winnerEntryId: winner.id, drawnAt: new Date() },
  });
  if (marked.count === 0) return { ok: false, error: "The winner has already been drawn" };

  refresh();
  return { ok: true, message: `Winner drawn: ${winner.email} (from ${entries.length} entries). Contact them by email.` };
}
