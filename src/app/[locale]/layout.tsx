import "../globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import {routing} from '../../i18n/routing';
import {notFound} from 'next/navigation';

export const metadata: Metadata = {
  title: "GoldBot by AL-ai-FX | Advanced Algorithmic Trading",
  description:
    "Automate your MT5 trading with GoldBot by AL-ai-FX. Subscribe, customize, and compile your exclusive Expert Advisor directly from our cloud service.",
  icons: {
    icon: "/favicon.png",
  },
};

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }
  const messages = await getMessages();
  const dir = locale === 'ar' || locale === 'ur' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Navbar />
        {children}
        <footer className="footer">
          <div className="footer-grid">
            <div>
              <h4>GoldBot by AL-ai-FX</h4>
              <p>
                Algorithmic tooling for MT5 automation workflows and
                account-specific deployment.
              </p>
            </div>
            <div>
              <h4>Legal</h4>
              <div className="footer-links">
                <Link href="/privacy-policy">Privacy Policy</Link>
                <Link href="/terms-conditions">Terms & Conditions</Link>
                <Link href="/refund-policy">Refund Policy</Link>
                <Link href="/disclaimer">Disclaimer</Link>
              </div>
            </div>
          </div>
          <p className="footer-note">
            &copy; {new Date().getFullYear()} AL-ai-FX Algorithms. GoldBot is a
            trademark of AL-ai-FX. Trading carries risk and past performance
            does not guarantee future results. See Disclaimer, Privacy Policy,
            Terms & Conditions, and Refund Policy.
          </p>
        </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
