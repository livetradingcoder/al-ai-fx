import { Suspense } from "react";
import type { Metadata } from "next";

import ThankYouClient from "./ThankYouClient";
import { SITE_URL, buildLocalizedUrl } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const canonical = buildLocalizedUrl(locale, "/checkout/thank-you");

  return {
    title: "GoldBot checkout status | AL-ai-FX",
    description: "Confirm your GoldBot payment and wait for account activation.",
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical,
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default function CheckoutThankYouPage() {
  return (
    <Suspense fallback={null}>
      <ThankYouClient />
    </Suspense>
  );
}
