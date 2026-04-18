import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function DashboardOverview() {
  const session = await getServerSession(authOptions);
  
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
        },
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  if (user?.shouldResetPassword) {
    redirect("/dashboard/reset-password");
  }

  const activeSub = user?.subscriptions[0];

  return (
    <div style={{ maxWidth: '900px' }}>
      <header style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Welcome back, {user?.name || 'Trader'}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Manage your GoldBot licenses and account data.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', marginBottom: '4rem' }}>
        
        {/* Active Subscription Card */}
        <div className="feature-card" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '0.5rem' }}>Active Plan</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', fontFamily: 'Outfit, sans-serif', marginBottom: '1rem' }}>
            {activeSub?.tier ? activeSub.tier.replace('_', ' ') : 'No Active Plan'}
          </div>
          <p style={{ color: activeSub ? 'var(--accent-accent)' : 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '600' }}>
            ● {activeSub ? 'Active' : 'Inactive'}
          </p>
        </div>

        {/* Linked Account Card */}
        <div className="feature-card">
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '0.5rem' }}>Registered MT5 Account</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', fontFamily: 'Outfit, sans-serif', marginBottom: '1rem' }}>
            {activeSub?.mt5AccountNumber || 'Not Linked'}
          </div>
          <Link href="/dashboard/licenses" style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', fontWeight: '600' }}>
            {activeSub?.mt5AccountNumber ? 'Change Account' : 'Link Account Now'}
          </Link>
        </div>
      </div>

      <section>
        <h2 style={{ fontSize: '1.8rem', textAlign: 'left', marginBottom: '1.5rem' }}>Download EA</h2>
        {activeSub ? (
          <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ marginBottom: '0.5rem' }}>GoldBot_v2.0_{activeSub.tier}.ex5</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {activeSub.mt5AccountNumber 
                  ? `Locked to Account ${activeSub.mt5AccountNumber}.` 
                  : 'Subscription active. Link an MT5 account to download.'}
              </p>
            </div>
            {activeSub.mt5AccountNumber ? (
              user?.subscriptions[0]?.compilations[0]?.id ? (
                <a 
                  href={`/api/compiler/download?jobId=${user.subscriptions[0].compilations[0].id}`} 
                  download 
                  className="btn-primary" 
                  style={{ textDecoration: 'none', padding: '0.8rem 2rem' }}
                >
                  Download Build
                </a>
              ) : (
                <Link href="/dashboard/licenses" className="btn-primary" style={{ textDecoration: 'none', padding: '0.8rem 2rem' }}>
                  Manage & Download
                </Link>
              )
            ) : (
              <Link href="/dashboard/licenses" className="btn-primary" style={{ textDecoration: 'none', padding: '0.8rem 2rem' }}>
                Setup License
              </Link>
            )}
          </div>
        ) : (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>You don&apos;t have an active subscription.</p>
            <Link href="/#pricing" className="btn-primary">View Pricing</Link>
          </div>
        )}
      </section>
    </div>
  );
}
