import type { Metadata } from "next";

import { getPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return getPageMetadata("disclaimer", locale);
}

export default function DisclaimerPage() {
  return (
    <main className="legal-page">
      <h1>Disclaimer</h1>
      <p>Last updated: April 16, 2026</p>
      <p>GoldBot is software tooling and does not provide financial, investment, or legal advice.</p>

      <section className="legal-block">
        <h2>Trading Risk Notice</h2>
        <p>Forex and CFD trading involve substantial risk and may not be suitable for all traders. You may lose some or all capital.</p>
      </section>

      <section className="legal-block">
        <h2>No Performance Guarantee</h2>
        <p>Past performance, historical examples, or user-shared outcomes do not guarantee future results.</p>
      </section>

      <section className="legal-block">
        <h2>User Responsibility</h2>
        <p>You are responsible for your broker selection, account settings, risk management, and whether to run any strategy in live markets.</p>
      </section>
    </main>
  );
}
