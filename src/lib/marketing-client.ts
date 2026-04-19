"use client";

import { getMarketingConfig } from "@/lib/marketing";

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

function runGtag(...args: unknown[]) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  window.gtag(...args);
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

export function trackBeginCheckout(payload: {
  amount: number;
  currency: string;
  orderRef: string;
  tier: string;
}) {
  runGtag("event", "begin_checkout", {
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

export function trackPurchase(payload: {
  amount: number;
  currency: string;
  orderRef: string;
  tier: string;
}) {
  const storage = getStorage();
  const trackingKey = `${TRACKED_PURCHASE_PREFIX}${payload.orderRef}`;

  if (storage?.getItem(trackingKey)) {
    return;
  }

  runGtag("event", "purchase", {
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
