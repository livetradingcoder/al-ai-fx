import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";

import CheckoutClient from "./CheckoutClient";
import { getPageMetadata } from "@/lib/seo";
import { prisma } from "@/lib/prisma";
import { getSettings, REF_COOKIE } from "@/lib/affiliate";
import { availableProviders } from "@/lib/payment-settings";
import { listCheckoutRobots, type CheckoutRobot } from "@/lib/checkout-robots";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return getPageMetadata("checkout", locale);
}

export default async function CheckoutPage() {
  // Which ways to pay are offered depends on the admin switches and the running
  // container's env, so the page must not be prerendered. The cookie read below already opts in,
  // this makes it explicit.
  await connection();
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

  // The robots and their prices ride along with the page so the first paint is
  // right. If the lookup fails the client fetches them itself.
  let initialRobots: CheckoutRobot[] | null = null;
  try {
    initialRobots = await listCheckoutRobots();
  } catch {
    // The client falls back to /api/robots.
  }

  const providers = await availableProviders();

  return <CheckoutClient referralDiscount={referralDiscount} providers={providers} initialRobots={initialRobots} />;
}
