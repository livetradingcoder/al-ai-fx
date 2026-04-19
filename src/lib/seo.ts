import type { Metadata, MetadataRoute } from "next";

import { routing } from "@/i18n/routing";

export const SITE_URL = "https://www.al-ai-fx.xyz";
const SITE_NAME = "GoldBot by AL-ai-FX";
const OG_IMAGE_URL = `${SITE_URL}/goldbot-social.png`;
const LAST_MODIFIED = new Date("2026-04-19T00:00:00.000Z");

export type Locale = (typeof routing.locales)[number];
export type PublicPageKey =
  | "home"
  | "checkout"
  | "faq"
  | "support"
  | "privacy-policy"
  | "terms-conditions"
  | "refund-policy"
  | "disclaimer";

type PageCopy = {
  title: string;
  description: string;
};

const PAGE_PATHS: Record<PublicPageKey, string> = {
  home: "/",
  checkout: "/checkout",
  faq: "/faq",
  support: "/support",
  "privacy-policy": "/privacy-policy",
  "terms-conditions": "/terms-conditions",
  "refund-policy": "/refund-policy",
  disclaimer: "/disclaimer",
};

const INDEXABLE_PAGES: PublicPageKey[] = [
  "home",
  "faq",
  "support",
  "privacy-policy",
  "terms-conditions",
  "refund-policy",
  "disclaimer",
];

const PAGE_CHANGE_FREQUENCY: Record<
  PublicPageKey,
  "weekly" | "monthly" | "yearly"
> = {
  home: "weekly",
  checkout: "monthly",
  faq: "monthly",
  support: "monthly",
  "privacy-policy": "yearly",
  "terms-conditions": "yearly",
  "refund-policy": "monthly",
  disclaimer: "yearly",
};

const PAGE_PRIORITIES: Record<PublicPageKey, number> = {
  home: 1,
  checkout: 0.6,
  faq: 0.8,
  support: 0.7,
  "privacy-policy": 0.4,
  "terms-conditions": 0.4,
  "refund-policy": 0.5,
  disclaimer: 0.4,
};

const PAGE_COPY: Record<Locale, Record<PublicPageKey, PageCopy>> = {
  en: {
    home: {
      title: "GoldBot for MT5 Gold Trading | Account-Bound EA by AL-ai-FX",
      description:
        "Explore GoldBot, an MT5 gold trading EA with account-bound cloud compilation, liquidity protection, and risk-aware automation for disciplined execution.",
    },
    checkout: {
      title: "GoldBot checkout | Secure plan activation",
      description:
        "Start your GoldBot plan securely and activate access to account-bound MT5 EA delivery through the AL-ai-FX checkout flow.",
    },
    faq: {
      title: "GoldBot FAQ | MT5 EA, licensing, and setup answers",
      description:
        "Read answers about GoldBot cloud compilation, MT5 account binding, subscriptions, prop-firm use, and GoldBot setup.",
    },
    support: {
      title: "GoldBot support | Contact AL-ai-FX support and billing",
      description:
        "Get GoldBot technical support, billing help, and account assistance from the AL-ai-FX team.",
    },
    "privacy-policy": {
      title: "Privacy policy | GoldBot by AL-ai-FX",
      description:
        "Review how AL-ai-FX collects, uses, and protects data for GoldBot accounts, payments, licensing, and support.",
    },
    "terms-conditions": {
      title: "Terms and conditions | GoldBot by AL-ai-FX",
      description:
        "Read the GoldBot terms covering licensing, account use, payments, service availability, and trading risk responsibilities.",
    },
    "refund-policy": {
      title: "Refund policy | GoldBot by AL-ai-FX",
      description:
        "Understand the GoldBot refund policy, including the 14-day stop-loss refund condition and claim requirements.",
    },
    disclaimer: {
      title: "Trading disclaimer | GoldBot by AL-ai-FX",
      description:
        "Review the GoldBot trading disclaimer covering market risk, no performance guarantees, and user responsibility.",
    },
  },
  de: {
    home: {
      title: "GoldBot fur MT5 Goldhandel | Kontogebundener EA von AL-ai-FX",
      description:
        "Entdecken Sie GoldBot, einen MT5-Goldhandels-EA mit kontogebundener Cloud-Kompilierung, Liquiditatsschutz und risikobewusster Automatisierung.",
    },
    checkout: {
      title: "GoldBot Checkout | Sichere Plan-Aktivierung",
      description:
        "Starten Sie Ihren GoldBot-Plan sicher und aktivieren Sie den Zugriff auf die kontogebundene MT5-EA-Bereitstellung.",
    },
    faq: {
      title: "GoldBot FAQ | Antworten zu MT5 EA, Lizenzierung und Setup",
      description:
        "Lesen Sie Antworten zu GoldBot Cloud-Kompilierung, MT5-Kontobindung, Abonnements, Prop-Firm-Nutzung und Einrichtung.",
    },
    support: {
      title: "GoldBot Support | Technischer Support und Abrechnung",
      description:
        "Erhalten Sie technische Hilfe, Billing-Support und Kontounterstutzung fur GoldBot von AL-ai-FX.",
    },
    "privacy-policy": {
      title: "Datenschutzerklarung | GoldBot von AL-ai-FX",
      description:
        "Erfahren Sie, wie AL-ai-FX Daten fur GoldBot-Konten, Zahlungen, Lizenzierung und Support verarbeitet und schutzt.",
    },
    "terms-conditions": {
      title: "AGB | GoldBot von AL-ai-FX",
      description:
        "Lesen Sie die GoldBot-Bedingungen zu Lizenzierung, Kontonutzung, Zahlungen, Verfugbarkeit und Handelsrisiken.",
    },
    "refund-policy": {
      title: "Erstattungsrichtlinie | GoldBot von AL-ai-FX",
      description:
        "Verstehen Sie die GoldBot-Erstattungsrichtlinie einschliesslich der 14-Tage-Stop-Loss-Erstattung und der Voraussetzungen.",
    },
    disclaimer: {
      title: "Risikohinweis | GoldBot von AL-ai-FX",
      description:
        "Prufen Sie den GoldBot-Hinweis zu Marktrisiken, fehlenden Performance-Garantien und Ihrer Verantwortung als Nutzer.",
    },
  },
  es: {
    home: {
      title: "GoldBot para trading de oro en MT5 | EA vinculado por cuenta",
      description:
        "Descubra GoldBot, un EA de oro para MT5 con compilacion en la nube vinculada a la cuenta, proteccion de liquidez y automatizacion con control de riesgo.",
    },
    checkout: {
      title: "Checkout de GoldBot | Activacion segura del plan",
      description:
        "Active su plan GoldBot de forma segura y obtenga acceso a la entrega de su EA de MT5 vinculado a la cuenta.",
    },
    faq: {
      title: "Preguntas frecuentes de GoldBot | MT5 EA, licencias y setup",
      description:
        "Consulte respuestas sobre compilacion en la nube, vinculacion de cuenta MT5, suscripciones, uso en prop firms y configuracion de GoldBot.",
    },
    support: {
      title: "Soporte de GoldBot | Ayuda tecnica y facturacion",
      description:
        "Obtenga ayuda tecnica, soporte de facturacion y asistencia con su cuenta GoldBot del equipo de AL-ai-FX.",
    },
    "privacy-policy": {
      title: "Politica de privacidad | GoldBot de AL-ai-FX",
      description:
        "Revise como AL-ai-FX recopila, usa y protege los datos de cuentas, pagos, licencias y soporte de GoldBot.",
    },
    "terms-conditions": {
      title: "Terminos y condiciones | GoldBot de AL-ai-FX",
      description:
        "Lea los terminos de GoldBot sobre licencias, uso de cuenta, pagos, disponibilidad del servicio y riesgos de trading.",
    },
    "refund-policy": {
      title: "Politica de reembolso | GoldBot de AL-ai-FX",
      description:
        "Entienda la politica de reembolso de GoldBot, incluida la condicion de reembolso por stop loss en 14 dias.",
    },
    disclaimer: {
      title: "Aviso legal de trading | GoldBot de AL-ai-FX",
      description:
        "Revise el aviso legal de GoldBot sobre riesgo de mercado, ausencia de garantias de rendimiento y responsabilidad del usuario.",
    },
  },
  ar: {
    home: {
      title: "GoldBot لتداول الذهب على MT5 | خبير آلي مرتبط بالحساب",
      description:
        "اكتشف GoldBot، وهو خبير آلي لتداول الذهب على MT5 مع تجميع سحابي مرتبط بالحساب وحماية للسيولة وأتمتة تراعي المخاطر.",
    },
    checkout: {
      title: "الدفع في GoldBot | تفعيل آمن للخطة",
      description:
        "ابدأ خطة GoldBot بشكل آمن واحصل على تفعيل الوصول إلى ملف MT5 المرتبط بحسابك.",
    },
    faq: {
      title: "الاسئلة الشائعة حول GoldBot | MT5 والترخيص والاعداد",
      description:
        "اقرأ الاجابات حول التجميع السحابي في GoldBot وربط حساب MT5 والاشتراكات واستخدام شركات التمويل والاعداد.",
    },
    support: {
      title: "دعم GoldBot | المساعدة الفنية والفوترة",
      description:
        "احصل على دعم فني ومساعدة في الفوترة والحساب من فريق AL-ai-FX لمنصة GoldBot.",
    },
    "privacy-policy": {
      title: "سياسة الخصوصية | GoldBot من AL-ai-FX",
      description:
        "راجع كيف تجمع AL-ai-FX بيانات حسابات GoldBot والمدفوعات والتراخيص والدعم وكيف تحميها.",
    },
    "terms-conditions": {
      title: "الشروط والاحكام | GoldBot من AL-ai-FX",
      description:
        "اقرأ شروط GoldBot المتعلقة بالترخيص واستخدام الحساب والمدفوعات وتوفر الخدمة ومسؤوليات مخاطر التداول.",
    },
    "refund-policy": {
      title: "سياسة الاسترداد | GoldBot من AL-ai-FX",
      description:
        "افهم سياسة استرداد GoldBot بما في ذلك شرط استرداد وقف الخسارة خلال 14 يوما ومتطلبات المطالبة.",
    },
    disclaimer: {
      title: "إخلاء مسؤولية التداول | GoldBot من AL-ai-FX",
      description:
        "راجع إخلاء المسؤولية الخاص بـ GoldBot حول مخاطر السوق وعدم وجود ضمانات أداء ومسؤولية المستخدم.",
    },
  },
  hi: {
    home: {
      title: "MT5 Gold Trading ke liye GoldBot | Account-bound EA",
      description:
        "GoldBot dekhen, jo MT5 gold trading ke liye account-bound cloud compilation, liquidity protection, aur risk-aware automation deta hai.",
    },
    checkout: {
      title: "GoldBot checkout | Secure plan activation",
      description:
        "Apna GoldBot plan securely start karein aur account-bound MT5 EA access activate karein.",
    },
    faq: {
      title: "GoldBot FAQ | MT5 EA, licensing aur setup",
      description:
        "GoldBot cloud compilation, MT5 account binding, subscriptions, prop-firm use aur setup ke jawab padhein.",
    },
    support: {
      title: "GoldBot support | Technical aur billing help",
      description:
        "AL-ai-FX team se GoldBot technical support, billing help, aur account assistance paayen.",
    },
    "privacy-policy": {
      title: "Privacy policy | GoldBot by AL-ai-FX",
      description:
        "Dekhen ki AL-ai-FX GoldBot accounts, payments, licensing aur support ke liye data kaise use aur protect karta hai.",
    },
    "terms-conditions": {
      title: "Terms and conditions | GoldBot by AL-ai-FX",
      description:
        "GoldBot licensing, account use, payments, service availability aur trading risk responsibilities ke terms padhein.",
    },
    "refund-policy": {
      title: "Refund policy | GoldBot by AL-ai-FX",
      description:
        "GoldBot refund policy samjhein, jismein 14-day stop-loss refund condition aur claim requirements shamil hain.",
    },
    disclaimer: {
      title: "Trading disclaimer | GoldBot by AL-ai-FX",
      description:
        "GoldBot market risk, no performance guarantee, aur user responsibility disclaimer ko padhein.",
    },
  },
  ur: {
    home: {
      title: "MT5 Gold Trading ke liye GoldBot | Account-bound EA",
      description:
        "GoldBot dekhen jo MT5 gold trading ke liye account-bound cloud compilation, liquidity protection, aur risk-aware automation deta hai.",
    },
    checkout: {
      title: "GoldBot checkout | Secure plan activation",
      description:
        "Apna GoldBot plan mehfooz tareeqe se shuru karein aur account-bound MT5 EA access activate karein.",
    },
    faq: {
      title: "GoldBot FAQ | MT5 EA, licensing aur setup",
      description:
        "GoldBot cloud compilation, MT5 account binding, subscriptions, prop-firm use aur setup ke jawab parhein.",
    },
    support: {
      title: "GoldBot support | Technical aur billing help",
      description:
        "AL-ai-FX team se GoldBot technical support, billing help, aur account assistance hasil karein.",
    },
    "privacy-policy": {
      title: "Privacy policy | GoldBot by AL-ai-FX",
      description:
        "Dekhen ke AL-ai-FX GoldBot accounts, payments, licensing aur support ke liye data kaise istemal aur mehfooz karta hai.",
    },
    "terms-conditions": {
      title: "Terms and conditions | GoldBot by AL-ai-FX",
      description:
        "GoldBot licensing, account use, payments, service availability aur trading risk responsibilities ke terms parhein.",
    },
    "refund-policy": {
      title: "Refund policy | GoldBot by AL-ai-FX",
      description:
        "GoldBot refund policy samjhein jismein 14-day stop-loss refund condition aur claim requirements shamil hain.",
    },
    disclaimer: {
      title: "Trading disclaimer | GoldBot by AL-ai-FX",
      description:
        "GoldBot market risk, no performance guarantee, aur user responsibility disclaimer ko parhein.",
    },
  },
  bn: {
    home: {
      title: "MT5 gold trading er jonno GoldBot | Account-bound EA",
      description:
        "GoldBot dekhun, jekhane MT5 gold trading er jonno account-bound cloud compilation, liquidity protection, ebong risk-aware automation royeche.",
    },
    checkout: {
      title: "GoldBot checkout | Nirapod plan activation",
      description:
        "Nirapod vabe apnar GoldBot plan shuru korun ebong account-bound MT5 EA access activate korun.",
    },
    faq: {
      title: "GoldBot FAQ | MT5 EA, licensing ebong setup",
      description:
        "GoldBot cloud compilation, MT5 account binding, subscription, prop-firm use ebong setup niye uttor porun.",
    },
    support: {
      title: "GoldBot support | Technical ebong billing help",
      description:
        "AL-ai-FX team theke GoldBot technical support, billing help, ebong account assistance nin.",
    },
    "privacy-policy": {
      title: "Privacy policy | GoldBot by AL-ai-FX",
      description:
        "Dekhun AL-ai-FX kivabe GoldBot account, payment, licensing ebong support er data byabohar o surakkha kore.",
    },
    "terms-conditions": {
      title: "Terms and conditions | GoldBot by AL-ai-FX",
      description:
        "GoldBot licensing, account use, payment, service availability, ebong trading risk responsibilities er terms porun.",
    },
    "refund-policy": {
      title: "Refund policy | GoldBot by AL-ai-FX",
      description:
        "GoldBot refund policy bujhun, jar moddhe 14-day stop-loss refund condition ebong claim requirements royeche.",
    },
    disclaimer: {
      title: "Trading disclaimer | GoldBot by AL-ai-FX",
      description:
        "GoldBot market risk, no performance guarantee, ebong user responsibility disclaimer porun.",
    },
  },
};

function getLocaleCopy(page: PublicPageKey, locale: string): PageCopy {
  const normalizedLocale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : routing.defaultLocale;

  return PAGE_COPY[normalizedLocale][page];
}

function getPathname(page: PublicPageKey) {
  return PAGE_PATHS[page];
}

export function buildLocalizedPath(locale: string, pathname: string) {
  const isDefaultLocale = locale === routing.defaultLocale;

  if (pathname === "/") {
    return isDefaultLocale ? "/" : `/${locale}`;
  }

  return isDefaultLocale ? pathname : `/${locale}${pathname}`;
}

export function buildLocalizedUrl(locale: string, pathname: string) {
  return new URL(buildLocalizedPath(locale, pathname), SITE_URL).toString();
}

function getLanguageAlternates(page: PublicPageKey) {
  const pathname = getPathname(page);
  const alternates = Object.fromEntries(
    routing.locales.map((locale) => [locale, buildLocalizedUrl(locale, pathname)]),
  ) as Record<string, string>;

  alternates["x-default"] = buildLocalizedUrl(routing.defaultLocale, pathname);

  return alternates;
}

export function getPageMetadata(page: PublicPageKey, locale: string): Metadata {
  const { title, description } = getLocaleCopy(page, locale);
  const pathname = getPathname(page);
  const canonical = buildLocalizedUrl(locale, pathname);
  const shouldIndex = page !== "checkout";

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: getLanguageAlternates(page),
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type: page === "home" ? "website" : "article",
      images: [
        {
          url: OG_IMAGE_URL,
          width: 1200,
          height: 630,
          alt: SITE_NAME,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE_URL],
    },
    robots: {
      index: shouldIndex,
      follow: true,
    },
    keywords: [
      "GoldBot",
      "MT5 EA",
      "gold trading bot",
      "MetaTrader 5 automation",
      "AL-ai-FX",
    ],
    category: "finance",
  };
}

export function getPublicSitemapEntries(): MetadataRoute.Sitemap {
  return INDEXABLE_PAGES.flatMap((page) => {
    const pathname = getPathname(page);

    return routing.locales.map((locale) => ({
      url: buildLocalizedUrl(locale, pathname),
      lastModified: LAST_MODIFIED,
      changeFrequency: PAGE_CHANGE_FREQUENCY[page],
      priority: PAGE_PRIORITIES[page],
    }));
  });
}
