import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ProofsAdmin, { type ResultRow, type ShareRow } from "./ProofsAdmin";

export const metadata = { title: "Results & shares" };

export default async function AdminProofsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") redirect("/dashboard");

  const [results, shares] = await Promise.all([
    prisma.resultProof.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        id: true,
        displayName: true,
        publishConsent: true,
        status: true,
        adminNote: true,
        publishedAt: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    }),
    prisma.shareProof.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        id: true,
        platform: true,
        url: true,
        status: true,
        adminNote: true,
        createdAt: true,
        coupon: { select: { code: true, redeemedCount: true } },
        user: { select: { email: true } },
      },
    }),
  ]);

  const resultRows: ResultRow[] = results.map((r) => ({
    id: r.id,
    email: r.user.email,
    displayName: r.displayName,
    publishConsent: r.publishConsent,
    status: r.status,
    adminNote: r.adminNote,
    published: !!r.publishedAt,
    createdAt: r.createdAt.toISOString(),
  }));

  const shareRows: ShareRow[] = shares.map((s) => ({
    id: s.id,
    email: s.user.email,
    platform: s.platform,
    url: s.url,
    status: s.status,
    adminNote: s.adminNote,
    code: s.coupon?.code ?? null,
    used: (s.coupon?.redeemedCount ?? 0) > 0,
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <>
      <header style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "2.1rem", marginBottom: "0.35rem" }}>Results &amp; shares</h1>
        <p style={{ color: "var(--text-secondary)", maxWidth: "72ch" }}>
          Screenshots arrive from the secret results link. Nothing is public until you approve it
          <em> and </em>publish it, and only when the person agreed to public display. Check that no
          account number is visible before publishing. Approving a shared post creates a one-time
          code for that person and emails it. Open the post first: reject it if it does not say the
          person gets a discount for sharing, or if it makes claims about profit.
        </p>
      </header>
      <ProofsAdmin results={resultRows} shares={shareRows} />
    </>
  );
}
