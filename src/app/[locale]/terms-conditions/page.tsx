import type { Metadata } from "next";

import { getPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return getPageMetadata("terms-conditions", locale);
}

export default function TermsConditionsPage() {
  return (
    <main className="legal-page">
      <h1>Terms & Conditions</h1>
      <p>Last updated: April 16, 2026</p>
      <p>By using GoldBot services, you agree to these terms regarding account use, licensing, payments, and acceptable use.</p>

      <section className="legal-block">
        <h2>License Use</h2>
        <p>Each subscription is intended for the licensed account scope defined in your plan. Unauthorized redistribution is prohibited.</p>
      </section>

      <section className="legal-block">
        <h2>Payments</h2>
        <p>Subscriptions are billed according to the selected plan. Renewal, cancellation, and billing details are managed through your account and payment provider flow.</p>
      </section>

      <section className="legal-block">
        <h2>Service Availability</h2>
        <p>We strive to maintain continuous service but do not guarantee uninterrupted availability at all times.</p>
      </section>

      <section className="legal-block">
        <h2>Liability</h2>
        <p>You acknowledge that trading involves financial risk, and you are solely responsible for your configuration choices and live account decisions.</p>
      </section>
    </main>
  );
}
