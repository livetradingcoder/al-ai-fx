import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import GiveawaysAdmin, { type GiveawayRow } from "./GiveawaysAdmin";

export const metadata = { title: "Giveaways" };

export default async function AdminGiveawaysPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") redirect("/dashboard");

  const [giveaways, optedIn] = await Promise.all([
    prisma.giveaway.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { _count: { select: { entries: true } } },
    }),
    prisma.emailSubscriber.count({ where: { source: { startsWith: "giveaway:" }, unsubscribedAt: null } }),
  ]);

  const winnerIds = giveaways.map((g) => g.winnerEntryId).filter((id): id is string => !!id);
  const winners = winnerIds.length
    ? await prisma.giveawayEntry.findMany({ where: { id: { in: winnerIds } }, select: { id: true, email: true } })
    : [];
  const winnerEmail = new Map(winners.map((w) => [w.id, w.email]));

  const rows: GiveawayRow[] = giveaways.map((g) => ({
    id: g.id,
    slug: g.slug,
    title: g.title,
    prize: g.prize,
    rulesText: g.rulesText,
    startsAt: g.startsAt.toISOString(),
    endsAt: g.endsAt.toISOString(),
    status: g.status,
    entries: g._count.entries,
    winner: g.winnerEntryId ? (winnerEmail.get(g.winnerEntryId) ?? null) : null,
  }));

  return (
    <>
      <header style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "2.1rem", marginBottom: "0.35rem" }}>Giveaways</h1>
        <p style={{ color: "var(--text-secondary)", maxWidth: "72ch" }}>
          One giveaway can be live at a time. Entering needs only an email; people who also tick the
          email box are added to your list ({optedIn} opted in right now). An approved results
          screenshot and an approved shared post each add one extra chance. Entries from restricted
          countries are skipped at the draw.
        </p>
      </header>
      <GiveawaysAdmin giveaways={rows} optedIn={optedIn} />
    </>
  );
}
