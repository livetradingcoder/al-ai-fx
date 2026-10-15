import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { licencesPerAccount } from "@/lib/trial-abuse";
import LicencesTable from "../LicencesTable";

export const metadata = { title: "Licences" };

export default async function AdminLicencesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session?.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  // Same working-set approach as the orders page: the table narrows it in the
  // browser, capped so the page stays cheap as the platform grows.
  const subscriptionRows = await prisma.subscription.findMany({
    take: 500,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { email: true } }, robot: { select: { name: true } } },
  });
  // How many licences have ever used each MT5 account, to flag one that is shared.
  const perAccount = await licencesPerAccount(
    subscriptionRows.flatMap((sub) => (sub.mt5AccountNumber ? [sub.mt5AccountNumber] : [])),
  );
  const licences = subscriptionRows.map((sub) => ({
    id: sub.id,
    email: sub.user.email,
    mt5AccountNumber: sub.mt5AccountNumber,
    accountLicences: sub.mt5AccountNumber ? (perAccount.get(sub.mt5AccountNumber) ?? 1) : 0,
    robot: sub.robot?.name ?? '—',
    tier: sub.tier,
    status: sub.status,
    createdAt: sub.createdAt.toISOString(),
  }));

  return (
    <div className="admin-container">
      <h1 style={{ fontSize: '2.1rem', marginBottom: '0.35rem' }}>Licences</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
        Every licence issued, including free trials. Search by email, MT5 account or robot.
      </p>
      <LicencesTable licences={licences} />
    </div>
  );
}
