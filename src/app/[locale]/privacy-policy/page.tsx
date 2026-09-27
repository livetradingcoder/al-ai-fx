import type { Metadata } from "next";

import { getPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return getPageMetadata("privacy-policy", locale);
}

export default function PrivacyPolicyPage() {
  return (
    <main className="legal-page">
      <h1>Privacy Policy</h1>
      <p>Last updated: September 27, 2026</p>
      <p>We collect only the information required to deliver your GoldBot subscription, account access, payment processing, and support operations.</p>

      <section className="legal-block">
        <h2>Data We Collect</h2>
        <p>We may collect account details (such as email), purchase metadata, and technical usage data required for licensing and security.</p>
      </section>

      <section className="legal-block">
        <h2>How Data Is Used</h2>
        <p>Your data is used to provision licenses, process payments, improve service quality, secure accounts, and respond to support requests.</p>
      </section>

      <section className="legal-block">
        <h2>Third-Party Services</h2>
        <p>Payments may be processed by third-party gateways including Paygate. Their privacy practices are governed by their own policies.</p>
      </section>

      <section className="legal-block">
        <h2>Cookies and Analytics</h2>
        <p>With your consent, we use Google Tag Manager and Google Analytics to measure visits and checkout activity, and advertising tags such as Google Ads and Meta to measure our campaigns. These set cookies in your browser. Visitors in the EEA, the UK and Switzerland are asked before any of these cookies are set. Everyone can accept or reject them in the cookie banner and change that choice at any time through &quot;Cookie settings&quot; in the site footer. Rejecting them does not affect your ability to use the site or buy a subscription.</p>
      </section>

      <section className="legal-block">
        <h2>Your Rights</h2>
        <p>You may request account data updates or deletion requests by contacting support through our support page.</p>
      </section>
    </main>
  );
}
