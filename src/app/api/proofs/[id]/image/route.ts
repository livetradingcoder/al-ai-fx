import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { promoEligibilityForRequest } from "@/lib/promo-eligibility";
import { readProofImage } from "@/lib/proof-storage";

/**
 * GET /api/proofs/[id]/image
 *
 * The only way to see a results screenshot. An admin can open any of them; the
 * public can open one only when it has been approved, the person agreed to
 * public display, an admin published it, and the visitor is somewhere
 * promotions are allowed. Everything else is a plain 404 so nothing is
 * confirmed or denied.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const notFound = () => new Response("Not Found", { status: 404 });

  const proof = await prisma.resultProof.findUnique({
    where: { id },
    select: { imageKey: true, contentType: true, status: true, publishedAt: true, publishConsent: true },
  });
  if (!proof) return notFound();

  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "ADMIN";

  if (!isAdmin) {
    const published = proof.status === "APPROVED" && !!proof.publishedAt && proof.publishConsent;
    if (!published) return notFound();
    const eligibility = await promoEligibilityForRequest(req);
    if (!eligibility.eligible) return notFound();
  }

  try {
    const bytes = await readProofImage(proof.imageKey);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": proof.contentType,
        // Private even for approved images: the answer depends on the visitor's country.
        "Cache-Control": isAdmin ? "private, no-store" : "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  } catch (err) {
    console.error("[proofs] image read failed:", err instanceof Error ? err.message : err);
    return notFound();
  }
}
