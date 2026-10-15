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
    id: "free-trials",
    title: "Free Trials",
    body: (
      <p>
        A free trial is for evaluating a robot yourself and is limited to one per person and one per MT5 account. An MT5 account that has
        already been linked to any GoldBot licence, free or paid, cannot be used for a new free trial. Creating several accounts to get repeated
        free trials is not allowed, and we may refuse a trial or withdraw a licence obtained that way.
      </p>
    ),
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
      updated="October 15, 2026"
      intro={"By using GoldBot services, you agree to these terms regarding account use, licensing, payments, and acceptable use."}
      sections={SECTIONS}
    />
  );
}
