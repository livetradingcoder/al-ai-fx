import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncLapsedSubscriptions } from "@/lib/subscription-expiry";
import { displayStatus, loadUnpaidAttempts } from "@/lib/payment-attempts";
import { redirect } from "next/navigation";
import OrdersTable, { type OrderRow } from "../OrdersTable";

export const metadata = { title: "Orders" };

export default async function AdminOrdersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session?.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  // Licence status below must reflect expiry dates that have passed.
  await syncLapsedSubscriptions();

  // The table searches, filters and paginates in the browser, so send a
  // working set rather than a 10-row slice — capped so the page stays cheap if
  // the platform grows into thousands.
  const [orderRows, trialRows, attemptRows] = await Promise.all([
    prisma.order.findMany({
      take: 500,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true } } },
    }),
    // A free trial is a licence with no payment behind it (provisionSubscription
    // writes no order for one), so it has to be read from the subscriptions.
    prisma.subscription.findMany({
      where: { tier: "FREE_TRIAL" },
      take: 500,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { email: true } },
        robot: { select: { name: true } },
      },
    }),
    // Payment attempts that never became an order (an order is written only
    // once money arrives, so these are the buyers who did not pay).
    loadUnpaidAttempts(),
  ]);
  const orders: OrderRow[] = [
    ...orderRows.map((order) => ({
      kind: "order" as const,
      id: order.id,
      email: order.user.email,
      tier: order.pricingTier,
      amount: order.amount,
      currency: order.currency,
      paygateId: order.paygateId,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
    })),
    ...trialRows.map((sub) => ({
      kind: "trial" as const,
      // Prefixed so a trial can never share a React key with an order.
      id: `trial:${sub.id}`,
      email: sub.user.email,
      tier: sub.tier,
      amount: 0,
      currency: "USD",
      paygateId: null,
      robotName: sub.robot.name,
      status: sub.status,
      createdAt: sub.createdAt.toISOString(),
    })),
    ...attemptRows.map((attempt) => ({
      kind: "attempt" as const,
      id: `attempt:${attempt.id}`,
      email: attempt.email,
      tier: attempt.tier,
      amount: attempt.amount ?? 0,
      currency: "USD",
      paygateId: attempt.orderRef,
      robotName: attempt.robotSlug,
      provider: attempt.provider,
      detail: attempt.detail ?? undefined,
      status: displayStatus(attempt.status, attempt.createdAt),
      createdAt: attempt.createdAt.toISOString(),
    })),
  ];

  return (
    <div className="admin-container">
      <h1 style={{ fontSize: '2.1rem', marginBottom: '0.35rem' }}>Orders</h1>
      <p style={{ color: 'var(--text-secondary)' }}>
        Every payment, free trial and payment attempt, newest first. An attempt is someone who pressed pay and
        did not complete it, with the reason when there is one. Search by email, robot or payment reference.
      </p>
      <OrdersTable orders={orders} />
    </div>
  );
}
