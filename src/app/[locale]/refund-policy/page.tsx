import type { Metadata } from "next";

import LegalDocument, { type LegalSection } from "@/components/site/LegalDocument";
import { getPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return getPageMetadata("refund-policy", locale);
}

const SECTIONS: LegalSection[] = [
  {
    id: "2-week-sl-full-refund-guarantee",
    title: "2-Week SL Full Refund Guarantee",
    body: <p>If the EA gets a stop loss (SL) within the first 14 calendar days from purchase, the robot price is refunded 100%.</p>,
  },
  {
    id: "claim-requirements",
    title: "Claim Requirements",
    body: <p>To process this guarantee, submit your purchase email, order details, and MT5 proof of the SL event within the same 14-day window.</p>,
  },
  {
    id: "free-trials",
    title: "Free Trials",
    body: (
      <p>
        Free trials cost nothing, so there is nothing to refund. A free trial is limited to one per MT5 account: an MT5 account that has already
        been linked to any GoldBot licence, free or paid, cannot be used for a new free trial. A licence that we withdraw because these rules
        were broken, for example by creating several accounts to get repeated free trials, is not eligible for a refund. This does not affect
        any rights you have by law.
      </p>
    ),
  },
  {
    id: "general-refund-requests",
    title: "General Refund Requests",
    body: <p>Requests outside the 14-day SL guarantee are reviewed case-by-case and may be denied if terms were breached or service delivery was completed.</p>,
  },
];

export default function RefundPolicyPage() {
  return (
    <LegalDocument
      path="/refund-policy"
      title="Refund Policy"
      updated="October 15, 2026"
      intro={"GoldBot includes a specific performance-based refund condition described below, plus standard support review for other requests."}
      sections={SECTIONS}
    />
  );
}
