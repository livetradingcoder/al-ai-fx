"use client";

import { CONSENT_STORAGE_KEY, parseConsentChoice, writeConsentCookie } from "@/lib/consent";
import {
  buildEcommerceDataLayerEvent,
  getMarketingConfig,
  type EcommerceEventInput,
} from "@/lib/marketing";
import {
  META_RELAYED_EVENTS,
  metaEventId,
  type MetaCustomData,
  type MetaEventName,
  type MetaRelayedEvent,
} from "@/lib/meta-shared";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    /** Set by the pixel snippet in MarketingScripts: the pixel it initialised. */
    __metaPixelId?: string;
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

// --- Meta ------------------------------------------------------------------------
//
// Every event is sent to OUR pixel only (trackSingle), never to "all pixels on
// the page": the GTM container carries a Meta tag for a different pixel, and a
// plain fbq('track') would feed that one our events too. Each carries an eventID
// so the Conversions API copy of the same event is counted once, not twice.

/** Whether the visitor has accepted advertising cookies. Nothing is relayed to our server without it. */
function hasAdConsent() {
  try {
    return parseConsentChoice(window.localStorage.getItem(CONSENT_STORAGE_KEY)) === "granted";
  } catch {
    return false;
  }
}

function newEventId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

const FBQ_RETRY_MS = 250;
const FBQ_MAX_TRIES = 20;

// The pixel script loads after hydration, and an event can fire before it has
// defined fbq; wait for it briefly rather than drop the event.
function fireFbq(name: string, data: MetaCustomData, eventId: string | null, tries = 0) {
  if (typeof window === "undefined") return;
  if (typeof window.fbq !== "function") {
    if (tries < FBQ_MAX_TRIES) window.setTimeout(() => fireFbq(name, data, eventId, tries + 1), FBQ_RETRY_MS);
    return;
  }

  const pixelId = window.__metaPixelId ?? marketingConfig.metaPixelId;
  if (!pixelId) return;
  window.fbq("trackSingle", pixelId, name, data, eventId ? { eventID: eventId } : {});
}

// The same browsing event, reported to our own endpoint so it survives an ad
// blocker. A payment or sign-up is never sent this way; the server sends those.
function relayToServer(name: MetaRelayedEvent, data: MetaCustomData, eventId: string) {
  if (!hasAdConsent()) return;
  try {
    void fetch("/api/meta/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: name, eventId, url: window.location.href, data }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Tracking is best-effort by design.
  }
}

/** Fires a Meta event; returns the event ID it used. */
export function trackMeta(name: MetaEventName, data: MetaCustomData, eventId: string = newEventId()) {
  fireFbq(name, data, eventId);
  if ((META_RELAYED_EVENTS as readonly string[]).includes(name)) {
    relayToServer(name as MetaRelayedEvent, data, eventId);
  }
  return eventId;
}

export type MetaItem = {
  amount: number;
  currency?: string;
  robotSlug?: string;
  robotName?: string;
  tierSlug?: string;
};

// The standard-event properties for one robot on one plan.
function productData(item: MetaItem): MetaCustomData {
  const value = Math.round(item.amount * 100) / 100;
  return {
    value,
    currency: (item.currency ?? "USD").toUpperCase(),
    content_type: "product",
    ...(item.robotSlug
      ? { content_ids: [item.robotSlug], contents: [{ id: item.robotSlug, quantity: 1, item_price: value }] }
      : {}),
    ...(item.robotName ? { content_name: item.robotName } : {}),
    ...(item.tierSlug ? { content_category: item.tierSlug } : {}),
    num_items: 1,
  };
}

// The pixel keeps _fbc itself, but only on a page it saw the fbclid on while
// allowed to set cookies. A visitor who lands from an ad and accepts a moment
// later would otherwise have no click ID. Meta documents building it from the
// fbclid in the URL, so do that once consent is given.
export function ensureFbcCookie() {
  if (typeof document === "undefined" || !hasAdConsent()) return;
  try {
    if (/(?:^|;\s*)_fbc=/.test(document.cookie)) return;
    const fbclid = new URLSearchParams(window.location.search).get("fbclid");
    if (!fbclid || !/^[A-Za-z0-9_-]{10,500}$/.test(fbclid)) return;

    const host = window.location.hostname;
    const parts = host.split(".");
    const isIp = /^\d+(\.\d+){3}$/.test(host);
    const domain = parts.length >= 2 && !isIp ? `; Domain=.${parts.slice(-2).join(".")}` : "";
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `_fbc=fb.1.${Date.now()}.${fbclid}; Max-Age=7776000; Path=/; SameSite=Lax${domain}${secure}`;
  } catch {
    // Cookies unavailable: the pixel's own copy, if any, still applies.
  }
}

/** Mirrors an earlier choice (made before the server could see it) into the cookie. */
export function syncConsentCookie() {
  try {
    const choice = parseConsentChoice(window.localStorage.getItem(CONSENT_STORAGE_KEY));
    if (choice) writeConsentCookie(choice);
  } catch {
    // Private mode: the banner's own click still writes the cookie.
  }
}

// --- the events the site reports -------------------------------------------------

export function trackPageView(url: string) {
  runGtag("event", "page_view", {
    page_location: url,
    send_to: marketingConfig.googleAdsId ?? undefined,
  });

  fireFbq("PageView", {}, null);
}

/** A robot's page was opened. */
export function trackViewContent(item: MetaItem) {
  trackMeta("ViewContent", productData(item));
}

/** A robot and plan was chosen. */
export function trackAddToCart(item: MetaItem) {
  trackMeta("AddToCart", productData(item));
}

/** Checkout was opened with a robot and plan. */
export function trackInitiateCheckout(item: MetaItem) {
  trackMeta("InitiateCheckout", productData(item));
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

  // The buyer has chosen how to pay and is about to be sent to the provider:
  // that is Meta's AddPaymentInfo. The server sent its copy as it created the
  // session, under the same ID.
  trackMeta(
    "AddPaymentInfo",
    productData({
      amount: payload.amount,
      currency: payload.currency,
      robotSlug: payload.robotSlug,
      robotName: payload.robotName,
      tierSlug: payload.tierSlug,
    }),
    metaEventId("AddPaymentInfo", payload.orderRef),
  );
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

  // The order reference is the event ID; the webhook sent the Conversions API
  // copy under the same one, and Meta keeps whichever it received first. An
  // order that cost nothing is not a purchase, and would drag the value down.
  if (payload.amount > 0) {
    trackMeta(
      "Purchase",
      { ...productData({ ...payload, tierSlug: payload.tierSlug }), order_id: payload.orderRef },
      metaEventId("Purchase", payload.orderRef),
    );
  }

  storage?.setItem(trackingKey, "1");
}

/** A free trial started. IDs come from the server's response, which sent the same events. */
export function trackStartTrial(input: { subscriptionId: string; robotSlug?: string; robotName?: string }) {
  trackMeta(
    "StartTrial",
    {
      value: 0,
      currency: "USD",
      ...(input.robotSlug ? { content_ids: [input.robotSlug] } : {}),
      ...(input.robotName ? { content_name: input.robotName } : {}),
    },
    metaEventId("StartTrial", input.subscriptionId),
  );
}

export function trackCompleteRegistration(input: { userId: string; robotName?: string }) {
  trackMeta(
    "CompleteRegistration",
    input.robotName ? { content_name: input.robotName } : {},
    metaEventId("CompleteRegistration", input.userId),
  );
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
