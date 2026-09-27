import { buildLocalizedPath } from "@/lib/seo";

// The GTM container for al-ai-fx.xyz. A container ID is public (it ships in
// the page source), so it lives here rather than in an env var nobody sets.
// NEXT_PUBLIC_GTM_ID overrides it, e.g. to silence tags on a staging host.
export const DEFAULT_GTM_ID = "GTM-PN7C6WJP";

type MarketingEnv = Partial<
  Record<
    | "NEXT_PUBLIC_GTM_ID"
    | "NEXT_PUBLIC_GOOGLE_ADS_ID"
    | "NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_BEGIN_CHECKOUT"
    | "NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_PURCHASE"
    | "NEXT_PUBLIC_META_PIXEL_ID",
    string
  >
>;

export type MarketingConfig = {
  gtmId: string | null;
  googleAdsId: string | null;
  beginCheckoutSendTo: string | null;
  purchaseSendTo: string | null;
  metaPixelId: string | null;
};

function cleanEnvValue(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildGoogleAdsSendTo(id?: string | null, label?: string | null) {
  const cleanId = cleanEnvValue(id ?? undefined);
  const cleanLabel = cleanEnvValue(label ?? undefined);

  if (!cleanId || !cleanLabel) {
    return null;
  }

  return `${cleanId}/${cleanLabel}`;
}

export function getMarketingConfig(env: MarketingEnv = process.env as unknown as MarketingEnv): MarketingConfig {
  const googleAdsId = cleanEnvValue(env.NEXT_PUBLIC_GOOGLE_ADS_ID);
  const beginCheckoutLabel = cleanEnvValue(
    env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_BEGIN_CHECKOUT,
  );
  const purchaseLabel = cleanEnvValue(env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_PURCHASE);

  return {
    gtmId: cleanEnvValue(env.NEXT_PUBLIC_GTM_ID) ?? DEFAULT_GTM_ID,
    googleAdsId,
    beginCheckoutSendTo: buildGoogleAdsSendTo(googleAdsId, beginCheckoutLabel),
    purchaseSendTo: buildGoogleAdsSendTo(googleAdsId, purchaseLabel),
    metaPixelId: cleanEnvValue(env.NEXT_PUBLIC_META_PIXEL_ID),
  };
}

export function buildCheckoutThankYouPath(locale: string, orderRef: string) {
  const pathname = buildLocalizedPath(locale, "/checkout/thank-you");
  return `${pathname}?orderRef=${encodeURIComponent(orderRef)}`;
}
