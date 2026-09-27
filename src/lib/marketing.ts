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

// Only a Google Ads ID (AW-…) belongs in NEXT_PUBLIC_GOOGLE_ADS_ID. Production
// once carried the GA4 ID there, which loaded GA4 straight from the app; GA4
// now runs inside the GTM container, so a G- ID here is ignored rather than
// loaded a second time.
function cleanGoogleAdsId(value?: string) {
  const id = cleanEnvValue(value);
  return id?.startsWith("AW-") ? id : null;
}

export function getMarketingConfig(env: MarketingEnv = process.env as unknown as MarketingEnv): MarketingConfig {
  const googleAdsId = cleanGoogleAdsId(env.NEXT_PUBLIC_GOOGLE_ADS_ID);
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

export type EcommerceEventInput = {
  amount: number;
  currency: string;
  orderRef: string;
  tier: string;
  robotName?: string;
  robotSlug?: string;
};

/**
 * The dataLayer message GTM's GA4 event tags read, in GA4's recommended
 * ecommerce shape: https://developers.google.com/analytics/devguides/collection/ga4/ecommerce
 */
export function buildEcommerceDataLayerEvent(
  event: "begin_checkout" | "purchase",
  input: EcommerceEventInput,
) {
  const itemName = input.robotName ? `${input.robotName} — ${input.tier}` : input.tier;

  return {
    event,
    ecommerce: {
      transaction_id: input.orderRef,
      currency: input.currency,
      value: input.amount,
      items: [
        {
          item_id: input.robotSlug ?? input.tier,
          item_name: itemName,
          item_variant: input.tier,
          price: input.amount,
          quantity: 1,
        },
      ],
    },
  };
}
