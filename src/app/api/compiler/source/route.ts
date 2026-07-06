// src/app/api/compiler/source/route.ts
//
// Authenticated decrypt-and-stream proxy for robot source at job time (SRCE-02/03).
//
// Private Vercel Blob stores have NO signed/expiring read URL, so the daemon
// cannot fetch the encrypted blob directly. Instead it calls THIS endpoint with:
//   Bearer COMPILER_SECRET  AND  a short-TTL HMAC token bound to {robotSlug, version, exp}
// The server reads the PRIVATE blob, decrypts it (SOURCE_ENCRYPTION_KEY never leaves
// the server — the daemon receives plaintext, never the key or ciphertext), and streams
// the plaintext .mq5 back with Cache-Control: private, no-store.
//
// URL contract (Plan 04-02/04-03 build this identically):
//   GET /api/compiler/source?robotSlug=<slug>&version=<N>&exp=<msEpoch>&token=<hmac>
import { fetchDecryptedSource } from "@/lib/source-storage";
import { verifySourceToken } from "@/lib/compiler-source-token";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.COMPILER_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const robotSlug = searchParams.get("robotSlug");
  const version = Number(searchParams.get("version"));
  const exp = Number(searchParams.get("exp"));
  const token = searchParams.get("token");

  if (!robotSlug || !Number.isInteger(version) || !token || !Number.isFinite(exp)) {
    return new Response("Bad request", { status: 400 });
  }
  if (!verifySourceToken(robotSlug, version, exp, token)) {
    return new Response("Forbidden", { status: 403 });
  }

  let plaintext: Buffer;
  try {
    plaintext = await fetchDecryptedSource(robotSlug, version);
  } catch (err) {
    // NEVER log the ciphertext or plaintext — generic message only.
    console.error("[source] fetch/decrypt failed:", err instanceof Error ? err.message : "unknown");
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(plaintext), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store", // sensitive — never CDN/browser cache
    },
  });
}
