import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import LicenseManager from "@/components/dashboard/LicenseManager";

export default async function LicensesPage() {
  const session = await getServerSession(authOptions) as any;
  
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      subscriptions: {
        where: { status: "ACTIVE" },
        include: {
          compilations: {
            orderBy: { createdAt: "desc" },
            take: 1
          }
        }
      }
    }
  });

  const activeSubs = user?.subscriptions || [];

  return (
    <div style={{ maxWidth: '900px' }}>
      <header style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>My Licenses</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Manage your active EA subscriptions and locked MT5 accounts.</p>
      </header>

      {activeSubs.length > 0 ? (
        activeSubs.map((sub: any) => (
          <LicenseManager 
            key={sub.id} 
            subscription={sub} 
            latestCompilation={sub.compilations[0] || null} 
          />
        ))
      ) : (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>No Active Licenses</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>You don't have any active GoldBot subscriptions yet.</p>
          <a href="/#pricing" className="btn-primary">View Pricing Plans</a>
        </div>
      )}
    </div>
  );
}
