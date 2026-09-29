import type { Metadata } from "next";

import LegalDocument, { type LegalSection } from "@/components/site/LegalDocument";
import { getPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return getPageMetadata("terms-conditions", locale);
}

const SECTIONS: LegalSection[] = [
  {
    id: "license-use",
    title: "License Use",
    body: <p>Each subscription is intended for the licensed account scope defined in your plan. Unauthorized redistribution is prohibited.</p>,
  },
  {
    id: "payments",
    title: "Payments",
    body: <p>Subscriptions are billed according to the selected plan. Renewal, cancellation, and billing details are managed through your account and payment provider flow.</p>,
  },
  {
    id: "service-availability",
    title: "Service Availability",
    body: <p>We strive to maintain continuous service but do not guarantee uninterrupted availability at all times.</p>,
  },
  {
    id: "liability",
    title: "Liability",
    body: <p>You acknowledge that trading involves financial risk, and you are solely responsible for your configuration choices and live account decisions.</p>,
  },
];

export default function TermsConditionsPage() {
  return (
    <LegalDocument
      path="/terms-conditions"
      title="Terms & Conditions"
      updated="April 16, 2026"
      intro={"By using GoldBot services, you agree to these terms regarding account use, licensing, payments, and acceptable use."}
      sections={SECTIONS}
    />
  );
}
