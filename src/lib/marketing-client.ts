"use client";

import {
  buildEcommerceDataLayerEvent,
  getMarketingConfig,
  type EcommerceEventInput,
} from "@/lib/marketing";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

export type PendingCheckout = {
  amount: number;
  checkoutUrl: string;
  currency: string;
  orderRef: string;
  // Optional: entries stored before these existed are still readable.
  robotName?: string;
  robotSlug?: string;
  tier: string;
};

const PENDING_CHECKOUT_PREFIX = "pending_checkout:";
const TRACKED_PURCHASE_PREFIX = "tracked_purchase:";
const marketingConfig = getMarketingConfig();

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage;
}

// Google Ads only. GA4 runs inside GTM and reads the dataLayer events below;
// every gtag() event here names the Ads ID in send_to so GTM's Google tag
// can't count it a second time.
function runGtag(...args: unknown[]) {
  if (!marketingConfig.googleAdsId || typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  window.gtag(...args);
}

// GTM reads events off window.dataLayer. Clearing `ecommerce` first stops
// GTM's merged data model from carrying one event's items into the next.
function pushEcommerceEvent(event: "begin_checkout" | "purchase", input: EcommerceEventInput) {
  if (typeof window === "undefined") {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push(buildEcommerceDataLayerEvent(event, input));
}

function runFbq(...args: unknown[]) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") {
    return;
  }

  window.fbq(...args);
}

export function trackPageView(url: string) {
  runGtag("event", "page_view", {
    page_location: url,
    send_to: marketingConfig.googleAdsId ?? undefined,
  });

  runFbq("track", "PageView");
}

export function trackViewContent(payload: {
  contentName: string;
  contentType: string;
  currency?: string;
  value?: number;
}) {
  runFbq("track", "ViewContent", {
    content_name: payload.contentName,
    content_type: payload.contentType,
    currency: payload.currency,
    value: payload.value,
  });
}

export function trackBeginCheckout(payload: EcommerceEventInput) {
  pushEcommerceEvent("begin_checkout", payload);

  runGtag("event", "begin_checkout", {
    send_to: marketingConfig.googleAdsId ?? undefined,
    currency: payload.currency,
    value: payload.amount,
    transaction_id: payload.orderRef,
  });

  if (marketingConfig.beginCheckoutSendTo) {
    runGtag("event", "conversion", {
      send_to: marketingConfig.beginCheckoutSendTo,
      currency: payload.currency,
      value: payload.amount,
      transaction_id: payload.orderRef,
    });
  }

  runFbq("track", "InitiateCheckout", {
    content_name: payload.tier,
    content_type: "product",
    currency: payload.currency,
    value: payload.amount,
  });
}

export function trackPurchase(payload: EcommerceEventInput) {
  const storage = getStorage();
  const trackingKey = `${TRACKED_PURCHASE_PREFIX}${payload.orderRef}`;

  if (storage?.getItem(trackingKey)) {
    return;
  }

  pushEcommerceEvent("purchase", payload);

  runGtag("event", "purchase", {
    send_to: marketingConfig.googleAdsId ?? undefined,
    currency: payload.currency,
    value: payload.amount,
    transaction_id: payload.orderRef,
  });

  if (marketingConfig.purchaseSendTo) {
    runGtag("event", "conversion", {
      send_to: marketingConfig.purchaseSendTo,
      currency: payload.currency,
      value: payload.amount,
      transaction_id: payload.orderRef,
    });
  }

  runFbq("track", "Purchase", {
    content_name: payload.tier,
    content_type: "product",
    currency: payload.currency,
    value: payload.amount,
  });

  storage?.setItem(trackingKey, "1");
}

export function storePendingCheckout(payload: PendingCheckout) {
  getStorage()?.setItem(`${PENDING_CHECKOUT_PREFIX}${payload.orderRef}`, JSON.stringify(payload));
}

export function getPendingCheckout(orderRef: string) {
  const rawValue = getStorage()?.getItem(`${PENDING_CHECKOUT_PREFIX}${orderRef}`);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as PendingCheckout;
  } catch {
    return null;
  }
}

export function clearPendingCheckout(orderRef: string) {
  getStorage()?.removeItem(`${PENDING_CHECKOUT_PREFIX}${orderRef}`);
}
