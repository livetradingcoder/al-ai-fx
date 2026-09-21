import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CouponsAdmin, { type CouponRow } from "./CouponsAdmin";

export const metadata = { title: "Coupons" };

export default async function AdminCouponsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") redirect("/dashboard");

  const [coupons, robots, redemptions] = await Promise.all([
    prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { robot: { select: { name: true } } },
    }),
    prisma.robot.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.couponRedemption.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { coupon: { select: { code: true } } },
    }),
  ]);

  const rows: CouponRow[] = coupons.map((c) => ({
    id: c.id,
    code: c.code,
    kind: c.kind,
    value: c.value,
    robotName: c.robot?.name ?? null,
    tier: c.tier,
    maxRedemptions: c.maxRedemptions,
    redeemedCount: c.redeemedCount,
    oncePerEmail: c.oncePerEmail,
    expiresAt: c.expiresAt?.toISOString() ?? null,
    active: c.active,
    note: c.note,
    createdAt: c.createdAt.toISOString(),
  }));

  const givenAway = redemptions.reduce((sum, r) => sum + (r.amountBefore - r.amountAfter), 0);

  return (
    <>
      <header style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "2.1rem", marginBottom: "0.35rem" }}>Coupons</h1>
        <p style={{ color: "var(--text-secondary)", maxWidth: "72ch" }}>
          A free code skips the payment page and creates the licence immediately — the purchase
          email, MT5 lock, compile and download all run exactly as they do for a paying customer,
          which is what makes it a real test. Percent and fixed codes discount a normal payment and
          are only consumed once the money arrives.
        </p>
      </header>

      <CouponsAdmin coupons={rows} robots={robots} />

      {redemptions.length > 0 && (
        <section className="card" style={{ marginTop: "20px" }}>
          <p className="card-label">Audit</p>
          <h2 style={{ fontSize: "1.15rem", margin: "6px 0 16px" }}>
            Recent redemptions · ${givenAway.toFixed(2)} discounted
          </h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Email</th>
                  <th>Bought</th>
                  <th>Paid</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {redemptions.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Code">{r.coupon.code}</td>
                    <td data-label="Email">{r.email}</td>
                    <td data-label="Bought">
                      <span className="cell-stack">
                        <span>{r.robotSlug}</span>
                        <span className="cell-note">{r.tier}</span>
                      </span>
                    </td>
                    <td data-label="Paid">
                      ${r.amountAfter.toFixed(2)}{" "}
                      <span className="cell-note">was ${r.amountBefore.toFixed(2)}</span>
                    </td>
                    <td data-label="When">{r.createdAt.toLocaleString()}</td>
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
