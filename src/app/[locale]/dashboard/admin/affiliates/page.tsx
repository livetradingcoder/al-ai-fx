import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings, getTiers, resolveRate } from "@/lib/affiliate";
import {
  AffiliatesPanel,
  CommissionsPanel,
  PayoutsPanel,
  SettingsPanel,
  type AffiliateRow,
} from "./AffiliateAdmin";

export const metadata = { title: "Affiliate programme" };

export default async function AdminAffiliatesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") redirect("/dashboard");

  const [settings, tiers, affiliates, commissions, payouts] = await Promise.all([
    getSettings(),
    getTiers(),
    prisma.affiliate.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        user: { select: { email: true } },
        _count: { select: { clicks: true, referrals: true } },
      },
    }),
    prisma.commission.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        affiliate: { include: { user: { select: { email: true } } } },
        order: { include: { user: { select: { email: true } } } },
      },
    }),
    prisma.affiliatePayout.findMany({
      orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
      take: 200,
      include: { affiliate: { include: { user: { select: { email: true } } } } },
    }),
  ]);

  // Money per affiliate in one grouped query rather than one per row.
  const sums = await prisma.commission.groupBy({
    by: ["affiliateId", "status"],
    _sum: { amount: true },
  });
  const bucket = (id: string, status: string) =>
    sums.find((s) => s.affiliateId === id && s.status === status)?._sum.amount ?? 0;

  const rows: AffiliateRow[] = await Promise.all(
    affiliates.map(async (a) => {
      const rate = await resolveRate(a.id);
      const pending = bucket(a.id, "PENDING");
      const approved = bucket(a.id, "APPROVED");
      const paid = bucket(a.id, "PAID");
      return {
        id: a.id,
        email: a.user.email,
        code: a.code,
        status: a.status,
        rateOverride: a.rateOverride,
        effectiveRate: rate.rate,
        tierName: rate.tierName,
        clicks: a._count.clicks,
        referrals: a._count.referrals,
        pending,
        approved,
        paid,
        lifetime: pending + approved + paid,
        payoutMethod: a.payoutMethod,
        payoutAddress: a.payoutAddress,
        createdAt: a.createdAt.toISOString(),
      };
    }),
  );

  const totals = {
    owed: rows.reduce((s, r) => s + r.approved, 0),
    holding: rows.reduce((s, r) => s + r.pending, 0),
    paid: rows.reduce((s, r) => s + r.paid, 0),
    referrals: rows.reduce((s, r) => s + r.referrals, 0),
  };

  return (
    <>
      <header style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "2.1rem", marginBottom: "0.35rem" }}>Affiliate programme</h1>
        <p style={{ color: "var(--text-secondary)", maxWidth: "72ch" }}>
          Commissions sit on hold for {settings.holdDays} days — the refund window — then you
          approve them and they become withdrawable. Payments happen outside the system; recording
          a reference here is what marks them settled.
        </p>
      </header>

      <div className="card-grid" style={{ marginBottom: "20px" }}>
        <div className="card">
          <p className="card-label">Owed now</p>
          <p className="card-value num" style={{ color: "var(--accent-primary)" }}>
            ${totals.owed.toFixed(2)}
          </p>
          <p className="cell-note">approved, not yet paid</p>
        </div>
        <div className="card">
          <p className="card-label">On hold</p>
          <p className="card-value num">${totals.holding.toFixed(2)}</p>
          <p className="cell-note">inside the refund window</p>
        </div>
        <div className="card">
          <p className="card-label">Paid out</p>
          <p className="card-value num">${totals.paid.toFixed(2)}</p>
          <p className="cell-note">all time</p>
        </div>
        <div className="card">
          <p className="card-label">Referred customers</p>
          <p className="card-value num">{totals.referrals}</p>
          <p className="cell-note">{rows.length} affiliates</p>
        </div>
      </div>

      <AffiliatesPanel affiliates={rows} />

      <CommissionsPanel
        commissions={commissions.map((c) => ({
          id: c.id,
          affiliateEmail: c.affiliate.user.email,
          customer: c.order.user.email,
          amount: c.amount,
          orderAmount: c.orderAmount,
          rate: c.rate,
          status: c.status,
          holdUntil: c.holdUntil.toISOString(),
          createdAt: c.createdAt.toISOString(),
        }))}
      />

      <PayoutsPanel
        payouts={payouts.map((p) => ({
          id: p.id,
          affiliateEmail: p.affiliate.user.email,
          amount: p.amount,
          method: p.method,
          address: p.address,
          status: p.status,
          reference: p.reference,
          requestedAt: p.requestedAt.toISOString(),
        }))}
      />

      <SettingsPanel
        settings={{
          cookieDays: settings.cookieDays,
          defaultRate: settings.defaultRate,
          referredDiscount: settings.referredDiscount,
          minPayout: settings.minPayout,
          holdDays: settings.holdDays,
          tierBasis: settings.tierBasis,
          lifetimeScope: settings.lifetimeScope,
          blockSelfReferral: settings.blockSelfReferral,
        }}
        tiers={tiers.map((t) => ({ id: t.id, name: t.name, threshold: t.threshold, rate: t.rate }))}
      />
    </>
  );
}
