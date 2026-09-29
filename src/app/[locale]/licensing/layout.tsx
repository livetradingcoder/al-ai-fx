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
    path: "/licensing",
    title: "Lifetime & source-code licensing | GoldBot by AL-ai-FX",
    description:
      "Lifetime access, source-code licences and private deals for GoldBot MT5 gold robots — arranged directly with the AL-ai-FX team.",
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
