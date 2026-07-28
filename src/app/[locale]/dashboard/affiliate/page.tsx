import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { affiliateBalance, getSettings, getTiers, resolveRate } from "@/lib/affiliate";
import { JoinCard, PayoutPanel, ShareBox } from "./AffiliateTools";
import EarningsTable, { type EarningRow } from "./EarningsTable";

export const metadata = { title: "Affiliate" };

/** Affiliates see who bought, not who they are: enough to recognise their own
 *  referral, not enough to harvest customer emails. */
function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return "•••";
  const head = name.slice(0, 2);
  return `${head}${"•".repeat(Math.max(name.length - 2, 2))}@${domain}`;
}

export default async function AffiliatePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [affiliate, settings, tiers] = await Promise.all([
    prisma.affiliate.findUnique({ where: { userId: session.user.id } }),
    getSettings(),
    getTiers(),
  ]);

  const host = (await headers()).get("host") ?? "al-ai-fx.xyz";
  const origin = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? `https://${host}`;

  if (!affiliate) {
    const entry = tiers[0]?.rate ?? settings.defaultRate;
    return (
      <>
        <header style={{ marginBottom: "26px" }}>
          <h1 style={{ fontSize: "2.1rem", marginBottom: "0.35rem" }}>Affiliate</h1>
          <p style={{ color: "var(--text-secondary)" }}>
            Get paid for every trader you send our way.
          </p>
        </header>
        <JoinCard rate={entry} />
      </>
    );
  }

  const [balance, rateInfo, commissions, referralCount, clickCount, payouts] = await Promise.all([
    affiliateBalance(affiliate.id),
    resolveRate(affiliate.id),
    prisma.commission.findMany({
      where: { affiliateId: affiliate.id },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        order: { include: { user: { select: { email: true } } } },
        referral: { select: { referredUserId: true } },
      },
    }),
    prisma.referral.count({ where: { affiliateId: affiliate.id } }),
    prisma.affiliateClick.count({ where: { affiliateId: affiliate.id } }),
    prisma.affiliatePayout.findMany({
      where: { affiliateId: affiliate.id },
      orderBy: { requestedAt: "desc" },
      take: 20,
    }),
  ]);

  // Robot names come from the subscription the order paid for; orders don't
  // carry a robot themselves.
  const subs = await prisma.subscription.findMany({
    where: { userId: { in: commissions.map((c) => c.order.userId) } },
    select: { userId: true, tier: true, robot: { select: { name: true } }, createdAt: true },
  });

  const rows: EarningRow[] = commissions.map((c) => {
    const match = subs.find((s) => s.userId === c.order.userId && s.tier === c.order.pricingTier);
    return {
      id: c.id,
      customer: maskEmail(c.order.user.email),
      robot: match?.robot.name ?? "—",
      tier: c.order.pricingTier,
      orderAmount: c.orderAmount,
      rate: c.rate,
      amount: c.amount,
      status: c.status,
      holdUntil: c.holdUntil.toISOString(),
      createdAt: c.createdAt.toISOString(),
    };
  });

  const progress = rateInfo.progress;
  const conversion = clickCount > 0 ? Math.round((referralCount / clickCount) * 100) : null;

  return (
    <>
      <header style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "2.1rem", marginBottom: "0.35rem" }}>Affiliate</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          You earn {rateInfo.rate}% of every order your referrals place — first purchase and every
          renewal after it.
        </p>
      </header>

      <div className="card-grid" style={{ marginBottom: "20px" }}>
        <div className="card">
          <p className="card-label">Ready to withdraw</p>
          <p className="card-value num" style={{ color: "var(--accent-primary)" }}>
            ${balance.approved.toFixed(2)}
          </p>
          <p className="cell-note">${balance.pending.toFixed(2)} still clearing</p>
        </div>
        <div className="card">
          <p className="card-label">Earned all time</p>
          <p className="card-value num">${balance.lifetime.toFixed(2)}</p>
          <p className="cell-note">${balance.paid.toFixed(2)} already paid out</p>
        </div>
        <div className="card">
          <p className="card-label">Referrals</p>
          <p className="card-value num">{referralCount}</p>
          <p className="cell-note">
            {clickCount} click{clickCount === 1 ? "" : "s"}
            {conversion !== null ? ` · ${conversion}% signed up` : ""}
          </p>
        </div>
        <div className="card">
          <p className="card-label">Your tier</p>
          <p className="card-value" style={{ color: "var(--accent-primary)" }}>
            {rateInfo.tierName} · {rateInfo.rate}%
          </p>
          {progress?.next ? (
            <>
              <div className="tier-bar" aria-hidden="true">
                <span
                  style={{
                    width: `${Math.min(100, Math.round((progress.total / progress.next.threshold) * 100))}%`,
                  }}
                />
              </div>
              <p className="cell-note">
                {progress.basis === "VOLUME"
                  ? `$${(progress.next.threshold - progress.total).toFixed(2)} more earned`
                  : `${progress.next.threshold - progress.total} more referrals`}{" "}
                → {progress.next.name} at {progress.next.rate}%
              </p>
            </>
          ) : (
            <p className="cell-note">Top tier — nothing above this.</p>
          )}
        </div>
      </div>

      <div className="split-grid split-grid-wide-first" style={{ marginBottom: "20px" }}>
        <ShareBox code={affiliate.code} origin={origin} />

        <div className="card">
          <p className="card-label">How it pays</p>
          <ol className="next-steps" style={{ marginTop: "12px" }}>
            <li>Someone opens your link and gets {settings.referredDiscount}% off their first purchase.</li>
            <li>You earn {rateInfo.rate}% of what they pay — every order, for as long as they stay.</li>
            <li>
              Commission clears after {settings.holdDays} days (our refund window), then it is
              yours to withdraw above ${settings.minPayout}.
            </li>
          </ol>
          <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginTop: "16px" }}>
            Tiers: {tiers.map((t) => `${t.name} ${t.rate}%`).join(" · ")} — based on{" "}
            {settings.tierBasis === "VOLUME" ? "commission earned" : "referrals who bought"}.
          </p>
        </div>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <EarningsTable rows={rows} />
      </div>

      <PayoutPanel
        method={affiliate.payoutMethod}
        address={affiliate.payoutAddress}
        approved={balance.approved}
        minPayout={settings.minPayout}
      />

      {payouts.length > 0 && (
        <section className="card" style={{ marginTop: "20px" }}>
          <p className="card-label">History</p>
          <h2 style={{ fontSize: "1.15rem", margin: "6px 0 16px" }}>Payouts</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Requested</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Requested">{p.requestedAt.toLocaleDateString()}</td>
                    <td data-label="Amount">${p.amount.toFixed(2)}</td>
                    <td data-label="Method">{p.method ?? "—"}</td>
                    <td data-label="Status">
                      <span
                        className="pill"
                        data-tone={p.status === "PAID" ? "live" : p.status === "REJECTED" ? "bad" : "soon"}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td data-label="Reference">{p.reference ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
