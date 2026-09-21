import type { Metadata } from "next";
import { cookies } from "next/headers";

import CheckoutClient from "./CheckoutClient";
import { getPageMetadata } from "@/lib/seo";
import { prisma } from "@/lib/prisma";
import { getSettings, REF_COOKIE } from "@/lib/affiliate";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return getPageMetadata("checkout", locale);
}

export default async function CheckoutPage() {
  // The cookie is httpOnly, so the client cannot see it — the server reads it
  // and tells the page what to promise. Only a live affiliate code counts, so
  // a stale or revoked one advertises nothing.
  let referralDiscount = 0;
  try {
    const code = (await cookies()).get(REF_COOKIE)?.value;
    if (code) {
      const [affiliate, settings] = await Promise.all([
        prisma.affiliate.findUnique({ where: { code: code.toUpperCase() } }),
        getSettings(),
      ]);
      if (affiliate?.status === "ACTIVE") referralDiscount = settings.referredDiscount;
    }
  } catch {
    // Never block checkout over a discount banner.
  }

  return <CheckoutClient referralDiscount={referralDiscount} />;
}
