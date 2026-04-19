import type { Metadata } from "next";

import CheckoutClient from "./CheckoutClient";
import { getPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return getPageMetadata("checkout", locale);
}

export default function CheckoutPage() {
  return <CheckoutClient />;
}
