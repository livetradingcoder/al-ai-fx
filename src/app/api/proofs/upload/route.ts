import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { MAX_PROOFS_PER_USER, cleanDisplayName, loadPortalContext } from "@/lib/proof-portal";
import { MAX_PROOF_BYTES, processProofImage, storeProofImage } from "@/lib/proof-storage";
import { checkProofUploadRateLimit, getClientIdentifier } from "@/lib/rate-limit";

// Slightly above the image limit: the form fields ride along in the same body.
const MAX_BODY_BYTES = MAX_PROOF_BYTES + 64 * 1024;

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * POST /api/proofs/upload (multipart: token, image, displayName?, publishConsent?)
 *
 * The results portal's screenshot upload. The signed token says who it is; the
 * image is sniffed, re-encoded and stored privately; the row waits for an admin.
 * Nothing here is public.
 */
export async function POST(req: Request) {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return fail("That image is too large. Use one under 4 MB.", 413);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("We could not read that upload.", 400);
  }

  const token = form.get("token");
  const ctx = await loadPortalContext(typeof token === "string" ? token : null);
  if (!ctx) return fail("This link is not valid any more. Ask for a new one.", 401);

  const { success } = await checkProofUploadRateLimit(`${ctx.userId}:${getClientIdentifier(req)}`);
  if (!success) return fail("Too many uploads. Please try again later.", 429);

  if (!ctx.linked) return fail("Link your MT5 account first, then send your results.", 409);

  const file = form.get("image");
  if (!(file instanceof File)) return fail("Choose a screenshot to upload.", 400);
  if (file.size > MAX_PROOF_BYTES) return fail("That image is too large. Use one under 4 MB.", 413);

  const count = await prisma.resultProof.count({
    where: { userId: ctx.userId, status: { in: ["PENDING", "APPROVED"] } },
  });
  if (count >= MAX_PROOFS_PER_USER) {
    return fail(`You have already sent ${MAX_PROOFS_PER_USER} screenshots. Thank you!`, 409);
  }

  const processed = await processProofImage(Buffer.from(await file.arrayBuffer()));
  if (!processed.ok) return fail(processed.error, 400);

  const duplicate = await prisma.resultProof.findUnique({
    where: { sha256: processed.sha256 },
    select: { id: true },
  });
  if (duplicate) return fail("That screenshot has already been sent.", 409);

  const id = randomUUID();
  try {
    const imageKey = await storeProofImage(id, processed.data);
    await prisma.resultProof.create({
      data: {
        id,
        userId: ctx.userId,
        subscriptionId: ctx.subscriptionId,
        imageKey,
        contentType: processed.contentType,
        sizeBytes: processed.data.length,
        sha256: processed.sha256,
        displayName: cleanDisplayName(form.get("displayName")),
        publishConsent: form.get("publishConsent") === "true",
      },
    });
  } catch (err) {
    console.error("[proofs] upload failed:", err instanceof Error ? err.message : err);
    return fail("We could not save that. Please try again.", 500);
  }

  return NextResponse.json({ ok: true, id }, { headers: { "Cache-Control": "no-store" } });
}
