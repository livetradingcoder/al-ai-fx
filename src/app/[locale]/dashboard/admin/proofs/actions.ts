"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import type { ActionResult } from "@/lib/action-result";
import { authOptions } from "@/lib/auth";
import { grantBonusEntry } from "@/lib/giveaway";
import { sendRewardCouponEmail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { createShareRewardCoupon, SHARE_REWARD_PERCENT } from "@/lib/rewards";

/** Null for an admin, otherwise the failure to hand straight back. */
async function requireAdmin(): Promise<ActionResult | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.role === "ADMIN" ? null : { ok: false, error: "Admins only" };
}

function refresh() {
  revalidatePath("/dashboard/admin/proofs");
  revalidatePath("/dashboard/admin");
  revalidatePath("/results");
}

async function latestCountry(userId: string): Promise<string | null> {
  const ip = await prisma.userIp.findFirst({
    where: { userId },
    orderBy: { lastSeenAt: "desc" },
    select: { country: true },
  });
  return ip?.country ?? null;
}

function cleanNote(note: string | null | undefined) {
  const text = (note ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 300);
  return text || null;
}

export async function reviewResultProof(input: {
  id: string;
  decision: "approve" | "reject";
  note?: string | null;
}): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const proof = await prisma.resultProof.findUnique({
    where: { id: input.id },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!proof) return { ok: false, error: "That screenshot no longer exists" };
  if (proof.status !== "PENDING") return { ok: false, error: `Already ${proof.status.toLowerCase()}` };

  const approve = input.decision === "approve";
  // Guarded on PENDING so two admins clicking at once cannot both grant the bonus entry.
  const changed = await prisma.resultProof.updateMany({
    where: { id: proof.id, status: "PENDING" },
    data: { status: approve ? "APPROVED" : "REJECTED", reviewedAt: new Date(), adminNote: cleanNote(input.note) },
  });
  if (changed.count === 0) return { ok: false, error: "Someone else just reviewed that one" };

  if (approve) {
    try {
      await grantBonusEntry({
        email: proof.user.email,
        userId: proof.user.id,
        source: "proof",
        country: await latestCountry(proof.user.id),
      });
    } catch (err) {
      console.error("[proofs] bonus entry failed (non-fatal):", err instanceof Error ? err.message : err);
    }
  }

  refresh();
  return { ok: true, message: approve ? "Approved. It is not public until you publish it." : "Rejected." };
}

export async function setProofPublished(input: { id: string; published: boolean }): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const proof = await prisma.resultProof.findUnique({
    where: { id: input.id },
    select: { status: true, publishConsent: true },
  });
  if (!proof) return { ok: false, error: "That screenshot no longer exists" };

  if (input.published) {
    if (proof.status !== "APPROVED") return { ok: false, error: "Approve it before publishing" };
    if (!proof.publishConsent) {
      return { ok: false, error: "The person did not agree to public display, so it cannot be published" };
    }
  }

  await prisma.resultProof.update({
    where: { id: input.id },
    data: { publishedAt: input.published ? new Date() : null },
  });
  refresh();
  return { ok: true, message: input.published ? "Published on the results page." : "Taken off the results page." };
}

export async function reviewShareProof(input: {
  id: string;
  decision: "approve" | "reject";
  note?: string | null;
}): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const share = await prisma.shareProof.findUnique({
    where: { id: input.id },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!share) return { ok: false, error: "That post no longer exists" };
  if (share.status !== "PENDING") return { ok: false, error: `Already ${share.status.toLowerCase()}` };

  if (input.decision === "reject") {
    const changed = await prisma.shareProof.updateMany({
      where: { id: share.id, status: "PENDING" },
      data: { status: "REJECTED", reviewedAt: new Date(), adminNote: cleanNote(input.note) },
    });
    if (changed.count === 0) return { ok: false, error: "Someone else just reviewed that one" };
    refresh();
    return { ok: true, message: "Rejected. They can send a different link." };
  }

  // The code and the approval commit together, and only while the share is
  // still pending, so one approval can never mint two codes.
  let coupon;
  try {
    coupon = await prisma.$transaction(async (tx) => {
      const claimed = await tx.shareProof.updateMany({
        where: { id: share.id, status: "PENDING" },
        data: { status: "APPROVED", reviewedAt: new Date(), adminNote: cleanNote(input.note) },
      });
      if (claimed.count === 0) return null;
      const created = await createShareRewardCoupon(tx, { userId: share.user.id, email: share.user.email });
      await tx.shareProof.update({ where: { id: share.id }, data: { couponId: created.id } });
      return created;
    });
  } catch (err) {
    console.error("[proofs] share approval failed:", err instanceof Error ? err.message : err);
    return { ok: false, error: "Could not create the reward code. Nothing was changed." };
  }
  if (!coupon) return { ok: false, error: "Someone else just reviewed that one" };

  try {
    await grantBonusEntry({
      email: share.user.email,
      userId: share.user.id,
      source: "share",
      country: await latestCountry(share.user.id),
    });
  } catch (err) {
    console.error("[proofs] bonus entry failed (non-fatal):", err instanceof Error ? err.message : err);
  }

  let emailed = false;
  try {
    const origin = (process.env.NEXTAUTH_URL || "https://www.al-ai-fx.xyz").replace(/\/+$/, "");
    await sendRewardCouponEmail({
      email: share.user.email,
      code: coupon.code,
      percent: SHARE_REWARD_PERCENT,
      expiresAt: coupon.expiresAt ?? new Date(),
      checkoutUrl: `${origin}/checkout?robot=goldbot&tier=1-month&coupon=${encodeURIComponent(coupon.code)}`,
    });
    emailed = true;
  } catch (err) {
    console.error("[proofs] reward email failed (non-fatal):", err instanceof Error ? err.message : err);
  }

  refresh();
  return {
    ok: true,
    message: `Approved. Code ${coupon.code} (${SHARE_REWARD_PERCENT}% off) is on their results page${
      emailed ? " and was emailed to them." : ". The email did not send, so pass the code on yourself."
    }`,
  };
}
