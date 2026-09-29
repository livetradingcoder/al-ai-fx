import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

// The page itself is a client component, so its metadata lives here.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale,
    path: "/features",
    title: "GoldBot features | Adaptive recovery, liquidity guard & account-locked MT5 builds",
    description:
      "How GoldBot trades gold on MT5: session breakouts with structured hedging, bank-holiday liquidity filters, and a private build compiled for your MT5 account in under 15 seconds.",
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
