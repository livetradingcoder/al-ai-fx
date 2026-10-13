// What the browser and the server both need to know about Meta events. Kept
// free of Node-only imports so the client bundle can use it.

export const META_EVENT_NAMES = [
  "ViewContent",
  "AddToCart",
  "InitiateCheckout",
  "AddPaymentInfo",
  "Purchase",
  "StartTrial",
  "CompleteRegistration",
] as const;

export type MetaEventName = (typeof META_EVENT_NAMES)[number];

/**
 * The events the browser reports to our own /api/meta/event, which relays them
 * to the Conversions API. The rest are sent by the route or webhook that causes
 * them, so nothing a visitor can post there can pass for a payment or a signup.
 */
export const META_RELAYED_EVENTS = ["ViewContent", "AddToCart", "InitiateCheckout"] as const;
export type MetaRelayedEvent = (typeof META_RELAYED_EVENTS)[number];

/** The standard-event properties we send. Currency and value are what Meta
 *  requires of a Purchase; the rest let it tell products apart. */
export type MetaCustomData = {
  value?: number;
  currency?: string;
  content_ids?: string[];
  content_type?: "product" | "product_group";
  content_name?: string;
  content_category?: string;
  contents?: { id: string; quantity: number; item_price?: number }[];
  num_items?: number;
  order_id?: string;
  predicted_ltv?: number;
};

const ID_PREFIX: Partial<Record<MetaEventName, string>> = {
  AddPaymentInfo: "pay",
  StartTrial: "trial",
  CompleteRegistration: "reg",
};

/**
 * The event_id the pixel and the Conversions API both send, which is how Meta
 * recognises the two copies as one event. It is derived from the order (or
 * subscription, or user) rather than generated, so the browser and the server
 * agree without either telling the other. A Purchase uses the order reference
 * as it is, which is what Meta suggests for purchases.
 */
export function metaEventId(name: MetaEventName, ref: string): string {
  const prefix = ID_PREFIX[name];
  return prefix ? `${prefix}:${ref}` : ref;
}
