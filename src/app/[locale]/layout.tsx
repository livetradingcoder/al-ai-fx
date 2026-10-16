import "../globals.css";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import Navbar from "../../components/Navbar";
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import {routing} from '../../i18n/routing';
import {notFound} from 'next/navigation';
import AuthSessionProvider from "@/components/AuthSessionProvider";
import MarketingPageTracker from "@/components/marketing/MarketingPageTracker";
import MarketingScripts from "@/components/marketing/MarketingScripts";
import ConsentBanner from "@/components/marketing/ConsentBanner";
import GiveawayPopup from "@/components/marketing/GiveawayPopup";
import RewardsPopup from "@/components/marketing/RewardsPopup";
import SiteFooter from "@/components/SiteFooter";
import GtmHeadScript from "@/components/marketing/GtmHeadScript";
import GtmNoScript from "@/components/marketing/GtmNoScript";
import NdeskWidget from "@/components/NdeskWidget";
import { authOptions } from "@/lib/auth";
import { getPageMetadata, jsonLdScript, organizationJsonLd, SITE_URL } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const metadata = getPageMetadata("home", locale);

  return {
    ...metadata,
    metadataBase: new URL(SITE_URL),
    applicationName: "GoldBot by AL-ai-FX",
    authors: [{ name: "AL-ai-FX", url: SITE_URL }],
    creator: "AL-ai-FX",
    publisher: "AL-ai-FX",
    formatDetection: { email: false, address: false, telephone: false },
    // The robot's head on the brand's dark tile: the old icon was the whole
    // logo with its wordmark, which is a smudge at tab size. The SVG is sharp
    // at any size; the PNG and the app/favicon.ico (which Next links by
    // itself) cover Safari, older browsers and home screens. "?v=" makes
    // browsers drop the icon they cached before.
    icons: {
      icon: [
        { url: "/icon.svg?v=2", type: "image/svg+xml", sizes: "any" },
        { url: "/icon-192.png?v=2", type: "image/png", sizes: "192x192" },
      ],
      apple: { url: "/apple-touch-icon.png?v=2", type: "image/png", sizes: "180x180" },
    },
  };
}

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  const messages = await getMessages();
  const session = await getServerSession(authOptions);
  const dir = locale === 'ar' || locale === 'ur' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir}>
      <head>
        <GtmHeadScript />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript(organizationJsonLd())}
        />
        <GtmNoScript />
        <AuthSessionProvider session={session}>
          <NextIntlClientProvider messages={messages}>
            <MarketingScripts />
            <MarketingPageTracker />
            <NdeskWidget />
            <Navbar />
          {children}
          <SiteFooter />
          <ConsentBanner />
          <GiveawayPopup />
          <RewardsPopup />
          </NextIntlClientProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
