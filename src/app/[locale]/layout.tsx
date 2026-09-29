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
    icons: {
      icon: "/favicon.png",
      apple: "/favicon.png",
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
          </NextIntlClientProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
