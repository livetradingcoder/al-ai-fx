import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import ProofPortal from "@/components/marketing/ProofPortal";
import "@/components/marketing/rewards.css";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadPortalContext, pickRewardSubscription, portalSnapshot, rewardProgress } from "@/lib/proof-portal";
import { createProofToken } from "@/lib/proof-token";
import { promoEligibilityForRequest } from "@/lib/promo-eligibility";
import { buildLoginRedirectPath } from "@/lib/auth-redirects";
import { Link } from "@/i18n/routing";

export const metadata = { title: "Rewards" };
export const dynamic = "force-dynamic";

export default async function RewardsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(buildLoginRedirectPath(locale, locale === "en" ? "/dashboard/rewards" : `/${locale}/dashboard/rewards`));
  }

  // The licence the rewards are for: prefer one with an MT5 account linked,
  // then the newest. Paid and trial licences both count; test tiers do not.
  const subscriptions = await prisma.subscription.findMany({
    where: { userId: session.user.id, tier: { not: "SECRET_TEST_TIER" } },
    orderBy: { createdAt: "desc" },
    select: { id: true, mt5AccountNumber: true },
  });
  const subscription = pickRewardSubscription(subscriptions);

  if (!subscription) {
    return (
      <div className="rw-scope">
        <header style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "2.1rem", marginBottom: "0.35rem" }}>Rewards</h1>
          <p style={{ color: "var(--text-secondary)", maxWidth: "64ch" }}>
            Start your free trial, link your MT5 account, and share your results to earn a discount and
            chances in our giveaway.
          </p>
        </header>
        <Link className="rw-btn" href="/catalog">
          See the robots
        </Link>
      </div>
    );
  }

  const token = createProofToken({ userId: session.user.id, subscriptionId: subscription.id });
  const ctx = await loadPortalContext(token);
  const req = new Request("https://internal.invalid/", { headers: await headers() });
  const eligibility = await promoEligibilityForRequest(req, locale);
  const snapshot = ctx ? await portalSnapshot(ctx, eligibility.eligible) : null;

  const progress = snapshot ? rewardProgress(snapshot).percent : 0;

  return (
    <div className="rw-scope">
      <header style={{ marginBottom: "22px" }}>
        <h1 style={{ fontSize: "2.1rem", marginBottom: "0.35rem" }}>Rewards</h1>
        <p style={{ color: "var(--text-secondary)", maxWidth: "70ch" }}>
          Show how your trial went and earn a discount code, plus extra chances in the giveaway. We never
          publish anything without your say-so and our review.
        </p>
      </header>

      <section className="rw-card" style={{ marginBottom: "18px" }} aria-label="Your progress">
        <div className="rw-row" style={{ justifyContent: "space-between", marginBottom: "10px" }}>
          <h2>Your progress</h2>
          <span className="rw-pill" data-tone={progress === 100 ? "live" : "wait"}>{progress}%</span>
        </div>
        <div className="rw-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </section>

      <ProofPortal token={token} locale={locale} initial={snapshot} />
    </div>
  );
}
