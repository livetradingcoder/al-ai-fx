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
    body: (
      <>
        <p>We may collect account details (such as email), purchase metadata, and technical usage data required for licensing and security.</p>
        <p>
          This includes the MT5 account number you link to a licence, and the IP address you use when you sign in, start a free trial or link
          an MT5 account. We also work out which country that IP address is in, using a database that runs on our own servers, so the address
          is not sent to anyone else for this.
        </p>
      </>
    ),
  },
  {
    id: "how-data-is-used",
    title: "How Data Is Used",
    body: <p>Your data is used to provision licenses, process payments, improve service quality, secure accounts, prevent abuse of free trials, and respond to support requests.</p>,
  },
  {
    id: "free-trials-and-abuse-prevention",
    title: "Free Trials and Abuse Prevention",
    body: (
      <>
        <p>
          A free trial can only be used once per MT5 account. An MT5 account that has already been linked to any GoldBot licence, free or
          paid, cannot be linked to a new free trial. To apply this rule we keep a record of every MT5 account number linked to a licence, and
          which licence it was linked to.
        </p>
        <p>
          We also use IP addresses and the countries they are in to spot several accounts being created from the same place to get repeated
          free trials. We do this because we have a legitimate interest in keeping free trials fair and in protecting our service from fraud
          and abuse. We use these records only for that purpose and to look into suspected abuse.
        </p>
        <p>
          Country lookups use GeoLite2 data created by MaxMind, available from{" "}
          <a href="https://www.maxmind.com" target="_blank" rel="noopener noreferrer">
            maxmind.com
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: "how-long-we-keep-it",
    title: "How Long We Keep It",
    body: (
      <p>
        IP addresses, and the country worked out from them, are deleted one year after we last saw them. MT5 account numbers linked to
        licences are kept for as long as we need them to apply the free-trial rule, so that deleting an account does not make an MT5 account
        eligible for a new free trial.
      </p>
    ),
  },
  {
    id: "third-party-services",
    title: "Third-Party Services",
    body: <p>Payments may be processed by third-party gateways including Paygate. Their privacy practices are governed by their own policies.</p>,
  },
  {
    id: "cookies-and-analytics",
    title: "Cookies and Analytics",
    body: <p>With your consent, we use Google Tag Manager and Google Analytics to measure visits and checkout activity, and advertising tags such as Google Ads and Meta to measure our campaigns. These set cookies in your browser. If you accept, we also send Meta, from our own servers, the purchases and sign-ups you complete here (your email address in hashed, one-way form, your IP address and browser details, and the order value) so that Meta can match them to its ads and measure results. We send nothing to Meta for visitors who reject. Visitors in the EEA, the UK and Switzerland are asked before any of these cookies are set. Everyone can accept or reject them in the cookie banner and change that choice at any time through &quot;Cookie settings&quot; in the site footer. Rejecting them does not affect your ability to use the site or buy a subscription.</p>,
  },
  {
    id: "your-rights",
    title: "Your Rights",
    body: <p>You may request account data updates or deletion requests by contacting support through our support page. If you object to how we use your data, contact us and we will review your request.</p>,
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument
      path="/privacy-policy"
      title="Privacy Policy"
      updated="October 15, 2026"
      intro={"We collect only the information required to deliver your GoldBot subscription, account access, payment processing, and support operations."}
      sections={SECTIONS}
    />
  );
}
