import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { loadPortalContext } from "@/lib/proof-portal";
import { promoEligibilityForRequest } from "@/lib/promo-eligibility";
import { checkProofActionRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { checkSocialUrl } from "@/lib/social-url";

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * POST /api/proofs/share { token, url, locale? }
 *
 * Submits the link to a social post that shares the person's results. It earns
 * a reward only once an admin has opened the link and approved it, so this just
 * records it. One per person; a rejected link can be replaced.
 */
export async function POST(req: Request) {
  const { success } = await checkProofActionRateLimit(getClientIdentifier(req));
  if (!success) return fail("Too many requests. Please try again in a minute.", 429);

  let body: { token?: unknown; url?: unknown; locale?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request.", 400);
  }

  const ctx = await loadPortalContext(typeof body.token === "string" ? body.token : null);
  if (!ctx) return fail("This link is not valid any more. Ask for a new one.", 401);

  const eligibility = await promoEligibilityForRequest(req, typeof body.locale === "string" ? body.locale : null);
  if (!eligibility.eligible) return fail("This reward is not available in your region.", 403);

  const checked = checkSocialUrl(body.url);
  if (!checked.ok) return fail(checked.error, 400);

  const proof = await prisma.resultProof.findFirst({
    where: { userId: ctx.userId, status: { in: ["PENDING", "APPROVED"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!proof) return fail("Send your results screenshot first, then share it.", 409);

  const existing = await prisma.shareProof.findUnique({
    where: { userId: ctx.userId },
    select: { id: true, status: true },
  });

  if (existing && existing.status !== "REJECTED") {
    return fail("You have already sent a post. We will review it soon.", 409);
  }

  const data = {
    resultProofId: proof.id,
    platform: checked.platform,
    url: checked.url,
    status: "PENDING" as const,
    adminNote: null,
    reviewedAt: null,
  };
  if (existing) {
    await prisma.shareProof.update({ where: { id: existing.id }, data });
  } else {
    await prisma.shareProof.create({ data: { ...data, userId: ctx.userId } });
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
