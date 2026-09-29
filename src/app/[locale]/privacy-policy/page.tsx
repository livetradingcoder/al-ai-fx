import type { Metadata } from "next";

import LegalDocument, { type LegalSection } from "@/components/site/LegalDocument";
import { getPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return getPageMetadata("privacy-policy", locale);
}

const SECTIONS: LegalSection[] = [
  {
    id: "data-we-collect",
    title: "Data We Collect",
    body: <p>We may collect account details (such as email), purchase metadata, and technical usage data required for licensing and security.</p>,
  },
  {
    id: "how-data-is-used",
    title: "How Data Is Used",
    body: <p>Your data is used to provision licenses, process payments, improve service quality, secure accounts, and respond to support requests.</p>,
  },
  {
    id: "third-party-services",
    title: "Third-Party Services",
    body: <p>Payments may be processed by third-party gateways including Paygate. Their privacy practices are governed by their own policies.</p>,
  },
  {
    id: "cookies-and-analytics",
    title: "Cookies and Analytics",
    body: <p>With your consent, we use Google Tag Manager and Google Analytics to measure visits and checkout activity, and advertising tags such as Google Ads and Meta to measure our campaigns. These set cookies in your browser. Visitors in the EEA, the UK and Switzerland are asked before any of these cookies are set. Everyone can accept or reject them in the cookie banner and change that choice at any time through &quot;Cookie settings&quot; in the site footer. Rejecting them does not affect your ability to use the site or buy a subscription.</p>,
  },
  {
    id: "your-rights",
    title: "Your Rights",
    body: <p>You may request account data updates or deletion requests by contacting support through our support page.</p>,
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument
      path="/privacy-policy"
      title="Privacy Policy"
      updated="September 27, 2026"
      intro={"We collect only the information required to deliver your GoldBot subscription, account access, payment processing, and support operations."}
      sections={SECTIONS}
    />
  );
}
