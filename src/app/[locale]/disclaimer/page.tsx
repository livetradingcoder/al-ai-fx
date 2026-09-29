import type { Metadata } from "next";

import LegalDocument, { type LegalSection } from "@/components/site/LegalDocument";
import { getPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return getPageMetadata("disclaimer", locale);
}

const SECTIONS: LegalSection[] = [
  {
    id: "trading-risk-notice",
    title: "Trading Risk Notice",
    body: <p>Forex and CFD trading involve substantial risk and may not be suitable for all traders. You may lose some or all capital.</p>,
  },
  {
    id: "no-performance-guarantee",
    title: "No Performance Guarantee",
    body: <p>Past performance, historical examples, or user-shared outcomes do not guarantee future results.</p>,
  },
  {
    id: "user-responsibility",
    title: "User Responsibility",
    body: <p>You are responsible for your broker selection, account settings, risk management, and whether to run any strategy in live markets.</p>,
  },
];

export default function DisclaimerPage() {
  return (
    <LegalDocument
      path="/disclaimer"
      title="Disclaimer"
      updated="April 16, 2026"
      intro={"GoldBot is software tooling and does not provide financial, investment, or legal advice."}
      sections={SECTIONS}
    />
  );
}
