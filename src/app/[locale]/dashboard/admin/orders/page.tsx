import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import OrdersTable from "../OrdersTable";

export const metadata = { title: "Orders" };

export default async function AdminOrdersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session?.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  // The table searches, filters and paginates in the browser, so send a
  // working set rather than a 10-row slice — capped so the page stays cheap if
  // the platform grows into thousands.
  const orderRows = await prisma.order.findMany({
    take: 500,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { email: true } } },
  });
  const orders = orderRows.map((order) => ({
    id: order.id,
    email: order.user.email,
    tier: order.pricingTier,
    amount: order.amount,
    currency: order.currency,
    paygateId: order.paygateId,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
  }));

  return (
    <div className="admin-container">
      <h1 style={{ fontSize: '2.1rem', marginBottom: '0.35rem' }}>Orders</h1>
      <p style={{ color: 'var(--text-secondary)' }}>
        Every payment, newest first. Search by email or payment reference.
      </p>
      <OrdersTable orders={orders} />
    </div>
  );
}
