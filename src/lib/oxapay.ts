import { createHmac, timingSafeEqual } from "node:crypto";

// OxaPay crypto checkout (https://docs.oxapay.com). Env (Coolify → al-ai-fx → env):
//   OXAPAY_MERCHANT_API_KEY  Merchant API key (OxaPay → Merchant Service). It
//                            authenticates invoice calls, keys the HMAC OxaPay
//                            puts on callbacks, and keys our own signature on
//                            the callback URL's query string.
//   OXAPAY_SANDBOX           "1" → invoices are created in OxaPay's sandbox
//                            (no real coins move). Unset in production.

const API = "https://api.oxapay.com/v1";

export function oxapayKey(): string | null {
  const key = process.env.OXAPAY_MERCHANT_API_KEY?.trim();
  return key ? key : null;
}

export function oxapayOrderRef(orderRef: string): string {
  return `OXAPAY-${orderRef}`;
}

export interface OxapayInvoiceInput {
  amount: number; // USD
  email: string;
  orderRef: string;
  description: string;
  callbackUrl: string;
  returnUrl: string;
  lifetimeMinutes?: number; // OxaPay: 15–2880, default 60
}

export interface OxapayInvoice {
  trackId: string;
  paymentUrl: string;
  expiresAt: number; // unix seconds
}

type InvoiceResponse = {
  status?: number;
  message?: string;
  error?: { type?: string; key?: string; message?: string } | null;
  data?: { track_id?: string; payment_url?: string; expired_at?: number };
};

// POST /v1/payment/invoice → hosted payment page. Amount is in USD; OxaPay
// quotes the coin amount to the payer.
export async function createOxapayInvoice(input: OxapayInvoiceInput): Promise<OxapayInvoice> {
  const key = oxapayKey();
  if (!key) throw new Error("oxapay not configured");
  const res = await fetch(`${API}/payment/invoice`, {
    method: "POST",
    headers: { merchant_api_key: key, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      amount: input.amount,
      currency: "USD",
      lifetime: input.lifetimeMinutes ?? 120,
      callback_url: input.callbackUrl,
      return_url: input.returnUrl,
      email: input.email,
      order_id: input.orderRef,
      description: input.description,
      sandbox: process.env.OXAPAY_SANDBOX === "1",
    }),
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json().catch(() => ({}))) as InvoiceResponse;
  if (!res.ok || !json.data?.payment_url || !json.data.track_id) {
    throw new Error(json.error?.message || json.message || `oxapay ${res.status}`);
  }
  return {
    trackId: json.data.track_id,
    paymentUrl: json.data.payment_url,
    expiresAt: json.data.expired_at ?? 0,
  };
}

function hexEqual(expected: string, provided: string | null | undefined): boolean {
  if (!provided) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided.trim().toLowerCase(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * OxaPay signs every callback: header `HMAC` = HMAC-SHA512 hex of the raw POST
 * body, keyed with the merchant API key. Verify the body exactly as received —
 * re-serialised JSON will not match.
 */
export function verifyOxapayBody(key: string, rawBody: string, provided: string | null | undefined): boolean {
  const expected = createHmac("sha512", key).update(rawBody).digest("hex");
  return hexEqual(expected, provided);
}

/**
 * Our own binding of the order into the callback URL. OxaPay's HMAC proves the
 * body is theirs, but the body only carries order_id/amount/email — robot and
 * tier live in the query string we set at invoice time. Signing them (and the
 * order ref, which must equal the body's order_id) means a genuine callback
 * can't be replayed against a different robot or tier. Payload order is
 * LOAD-BEARING and must match between checkout and webhook:
 *   `${order_ref}${email}${robot}${tier}${amount}`
 */
export interface CallbackParams {
  order_ref: string;
  email: string;
  robot: string;
  tier: string;
  amount: string; // fixed(2)
}

export function callbackSignaturePayload(p: CallbackParams): string {
  return `${p.order_ref}${p.email}${p.robot}${p.tier}${p.amount}`;
}

export function signCallbackParams(key: string, p: CallbackParams): string {
  return createHmac("sha256", key).update(callbackSignaturePayload(p)).digest("hex");
}

export function verifyCallbackParams(key: string, p: CallbackParams, provided: string | null | undefined): boolean {
  return hexEqual(signCallbackParams(key, p), provided);
}

// Callback `status` is capitalised ("Paid") while the status table is lower
// case ("paid"); compare case-insensitively. Only "paid" fulfils an order —
// "paying" arrives first while the transaction confirms.
export function isOxapayPaid(status: unknown): boolean {
  return typeof status === "string" && status.trim().toLowerCase() === "paid";
}

export interface OxapayCallback {
  track_id?: string;
  status?: string;
  type?: string; // "invoice" | "payout"
  amount?: number | string;
  currency?: string;
  order_id?: string;
  email?: string;
  date?: number;
}
