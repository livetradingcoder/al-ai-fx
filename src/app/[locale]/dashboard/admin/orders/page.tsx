import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import OrdersTable, { type OrderRow } from "../OrdersTable";

export const metadata = { title: "Orders" };

export default async function AdminOrdersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session?.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  // The table searches, filters and paginates in the browser, so send a
  // working set rather than a 10-row slice — capped so the page stays cheap if
  // the platform grows into thousands.
  const [orderRows, trialRows] = await Promise.all([
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
  ];

  return (
    <div className="admin-container">
      <h1 style={{ fontSize: '2.1rem', marginBottom: '0.35rem' }}>Orders</h1>
      <p style={{ color: 'var(--text-secondary)' }}>
        Every payment and free trial, newest first. Search by email, robot or payment reference.
      </p>
      <OrdersTable orders={orders} />
    </div>
  );
}
