/**
 * Meta Conversions API: builds server events and posts them to Graph.
 *
 * The pixel (browser) and this (server) send the same event with the same
 * event_id, and Meta keeps one. The server copy is the dependable one: it
 * survives ad blockers, and it carries the match keys the pixel doesn't have
 * (hashed email, the IP, the user agent). Rules followed, from Meta's docs:
 *
 *  - em, fn, ln, ct, st, zp, country and external_id are normalised and then
 *    hashed with SHA-256; client_ip_address, client_user_agent, fbp and fbc are
 *    sent as they are (fbc is case-sensitive: never lowercase it).
 *  - A website event needs event_source_url and client_user_agent.
 *  - A Purchase needs value and currency.
 *  - event_time is in seconds and must be recent; events go out as they happen.
 *
 * Environment (all optional except the token):
 *   META_CAPI_ACCESS_TOKEN     secret; without it nothing is sent
 *   NEXT_PUBLIC_META_PIXEL_ID  overrides the public pixel in lib/marketing; the
 *                              browser and this file read the same value, so the
 *                              two copies of an event always land in one dataset
 *   META_CAPI_TEST_EVENT_CODE  routes every event to Events Manager's Test Events
 *   META_GRAPH_API_VERSION     defaults to DEFAULT_GRAPH_API_VERSION
 */
import { createHash } from "node:crypto";
import { isIP } from "node:net";

import { DEFAULT_META_PIXEL_ID } from "@/lib/marketing";
import type { MetaCustomData, MetaEventName } from "@/lib/meta-shared";

// Graph API v26.0 came out 2026-07-29; older versions are retired on a fixed
// schedule, so this is the one to bump rather than pin forever.
export const DEFAULT_GRAPH_API_VERSION = "v26.0";

const GRAPH_BASE_URL = "https://graph.facebook.com";

export function sha256Hex(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

// --- normalisation (Meta's rules, per field) ---------------------------------

export const normalizeEmail = (v: string) => v.trim().toLowerCase();
export const normalizeName = (v: string) => v.trim().toLowerCase().replace(/[^\p{L}]/gu, "");
export const normalizeCity = (v: string) => v.trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
export const normalizeState = (v: string) => v.trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
export const normalizeCountry = (v: string) => {
  const code = v.trim().toLowerCase();
  return /^[a-z]{2}$/.test(code) ? code : "";
};
export function normalizeZip(v: string) {
  const zip = v.trim().toLowerCase().replace(/[\s-]/g, "");
  // US ZIP+4 is reduced to its first five digits.
  return /^\d{9}$/.test(zip) ? zip.slice(0, 5) : zip;
}
export const normalizeExternalId = (v: string) => v.trim();

function hashed(value: string | null | undefined, normalize: (v: string) => string) {
  if (!value) return undefined;
  const normalized = normalize(value);
  return normalized ? [sha256Hex(normalized)] : undefined;
}

// --- request-derived values ---------------------------------------------------

const FB_COOKIE = /^fb\.[0-9]\.[0-9]{10,13}\.[A-Za-z0-9._-]{1,300}$/;
export const isValidFbp = (v: string | null | undefined): v is string => !!v && FB_COOKIE.test(v);
export const isValidFbc = isValidFbp;

/** The Cookie header as a map. Values are kept exactly as sent (fbc is case-sensitive). */
export function parseCookies(header: string | null | undefined) {
  const cookies: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const at = part.indexOf("=");
    if (at < 1) continue;
    const name = part.slice(0, at).trim();
    if (!(name in cookies)) cookies[name] = part.slice(at + 1).trim();
  }
  return cookies;
}

/**
 * Meta's fallback for a missing _fbc cookie: build it from the fbclid in the
 * page URL, as fb.<subdomain index>.<time the click was seen, ms>.<fbclid>.
 * The index is 1 for a registrable domain such as al-ai-fx.xyz.
 */
export function fbcFromUrl(url: string | null | undefined, nowMs: number = Date.now()) {
  if (!url) return undefined;
  try {
    const fbclid = new URL(url).searchParams.get("fbclid");
    return fbclid && /^[A-Za-z0-9_-]{10,500}$/.test(fbclid) ? `fb.1.${nowMs}.${fbclid}` : undefined;
  } catch {
    return undefined;
  }
}

/** A usable client IP: valid, public, IPv4-mapped IPv6 unwrapped. Never hashed. */
export function cleanClientIp(raw: string | null | undefined) {
  let ip = (raw ?? "").split(",")[0].trim();
  if (ip.toLowerCase().startsWith("::ffff:") && isIP(ip.slice(7)) === 4) ip = ip.slice(7);
  const family = isIP(ip);
  if (!family) return undefined;
  if (family === 4) {
    const [a, b] = ip.split(".").map(Number);
    const privateRange =
      a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
    return privateRange ? undefined : ip;
  }
  const lower = ip.toLowerCase();
  return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80")
    ? undefined
    : ip;
}

// --- payload ------------------------------------------------------------------

export type MetaUserInput = {
  email?: string | null;
  /** Our own stable ID for the person, e.g. the user id. Hashed before sending. */
  externalId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
};

export type MetaUserData = Record<string, string | string[]>;

export function buildUserData(input: MetaUserInput): MetaUserData {
  const data: MetaUserData = {};
  const set = (key: string, value: string | string[] | undefined) => {
    if (value && value.length) data[key] = value;
  };

  set("em", hashed(input.email, normalizeEmail));
  set("external_id", hashed(input.externalId, normalizeExternalId));
  set("fn", hashed(input.firstName, normalizeName));
  set("ln", hashed(input.lastName, normalizeName));
  set("ct", hashed(input.city, normalizeCity));
  set("st", hashed(input.state, normalizeState));
  set("zp", hashed(input.zip, normalizeZip));
  set("country", hashed(input.country, normalizeCountry));

  set("client_ip_address", cleanClientIp(input.ip));
  set("client_user_agent", input.userAgent?.trim().slice(0, 512) || undefined);
  set("fbp", isValidFbp(input.fbp) ? input.fbp : undefined);
  set("fbc", isValidFbc(input.fbc) ? input.fbc : undefined);
  return data;
}

export type MetaServerEvent = {
  event_name: MetaEventName;
  event_time: number;
  event_id: string;
  event_source_url: string;
  action_source: "website";
  user_data: MetaUserData;
  custom_data?: MetaCustomData;
};

export const roundMoney = (n: number) => Math.round(n * 100) / 100;

/**
 * A website event, or null when Meta would reject it: a website event needs the
 * page URL and the user agent, and a Purchase needs a positive value and a currency.
 */
export function buildServerEvent(input: {
  name: MetaEventName;
  eventId: string;
  sourceUrl?: string | null;
  user: MetaUserInput;
  custom?: MetaCustomData;
  timeSec?: number;
}): MetaServerEvent | null {
  const userData = buildUserData(input.user);
  if (!input.sourceUrl || !userData.client_user_agent || !input.eventId) return null;
  // The user agent alone is not a match key: want at least one more.
  if (Object.keys(userData).length < 2) return null;

  const custom = input.custom;
  if (input.name === "Purchase") {
    if (!custom || !(typeof custom.value === "number" && custom.value > 0) || !custom.currency) return null;
  }

  return {
    event_name: input.name,
    event_time: input.timeSec ?? Math.floor(Date.now() / 1000),
    event_id: input.eventId,
    event_source_url: input.sourceUrl,
    action_source: "website",
    user_data: userData,
    ...(custom && Object.keys(custom).length ? { custom_data: custom } : {}),
  };
}

// --- sending -----------------------------------------------------------------

export function metaConfig() {
  const env = process.env;
  const clean = (v: string | undefined) => v?.trim() || null;
  // The destination is overridable only outside production, so a test can point
  // it at a local mock without the token ever being able to go anywhere else.
  const override = env.NODE_ENV === "production" ? null : clean(env.META_GRAPH_BASE_URL);
  return {
    token: clean(env.META_CAPI_ACCESS_TOKEN),
    pixelId: clean(env.NEXT_PUBLIC_META_PIXEL_ID) ?? DEFAULT_META_PIXEL_ID,
    testEventCode: clean(env.META_CAPI_TEST_EVENT_CODE),
    version: clean(env.META_GRAPH_API_VERSION) ?? DEFAULT_GRAPH_API_VERSION,
    baseUrl: (override ?? GRAPH_BASE_URL).replace(/\/$/, ""),
  };
}

export function isMetaConfigured() {
  return metaConfig().token !== null;
}

export type MetaSendResult = {
  ok: boolean;
  skipped?: boolean;
  status?: number;
  eventsReceived?: number;
  fbtraceId?: string;
  error?: string;
  test: boolean;
};

export type MetaSendRecord = MetaSendResult & { at: number; events: string[] };

// The last few sends, kept in memory so the admin page can show whether Meta is
// accepting what we send. Resets on a restart, which is fine for a health check.
// On globalThis because the routes and the admin page can each load their own
// copy of this module, and they must all write to and read the same list.
const RECENT_LIMIT = 20;
const shared = globalThis as unknown as { __metaRecentSends?: MetaSendRecord[] };
const recent: MetaSendRecord[] = (shared.__metaRecentSends ??= []);

export function getRecentMetaSends(): MetaSendRecord[] {
  return [...recent].reverse();
}

function remember(events: MetaServerEvent[], result: MetaSendResult) {
  recent.push({ ...result, at: Date.now(), events: events.map((e) => e.event_name) });
  if (recent.length > RECENT_LIMIT) recent.shift();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type GraphResponse = {
  events_received?: number;
  fbtrace_id?: string;
  error?: { message?: string; code?: number; error_subcode?: number; fbtrace_id?: string };
};

/**
 * POSTs events to Graph. Never throws: a failed send is reported in the result
 * and logged (without the payload or the token), because tracking must not be
 * able to break the checkout or the webhook that called it.
 */
export async function sendMetaEvents(
  events: MetaServerEvent[],
  options: { testEventCode?: string | null } = {},
): Promise<MetaSendResult> {
  const config = metaConfig();
  const testEventCode = options.testEventCode ?? config.testEventCode;
  const test = Boolean(testEventCode);

  if (!config.token) return { ok: false, skipped: true, error: "META_CAPI_ACCESS_TOKEN is not set", test };
  if (events.length === 0) return { ok: true, skipped: true, test };

  const url = `${config.baseUrl}/${config.version}/${encodeURIComponent(config.pixelId)}/events`;
  const body = JSON.stringify({
    data: events,
    access_token: config.token,
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  });

  let result: MetaSendResult = { ok: false, error: "not sent", test };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(5000),
      });
      const json = (await res.json().catch(() => null)) as GraphResponse | null;
      if (res.ok) {
        result = {
          ok: true,
          status: res.status,
          eventsReceived: json?.events_received,
          fbtraceId: json?.fbtrace_id,
          test,
        };
        break;
      }
      const e = json?.error;
      result = {
        ok: false,
        status: res.status,
        fbtraceId: e?.fbtrace_id ?? json?.fbtrace_id,
        error: e?.message ?? `HTTP ${res.status}`,
        test,
      };
      // A 4xx is our request being wrong; only a server-side hiccup is worth a retry.
      if (res.status < 500) break;
    } catch (err) {
      result = { ok: false, error: err instanceof Error ? err.message : "request failed", test };
    }
    if (attempt === 0) await sleep(400);
  }

  remember(events, result);
  if (!result.ok) {
    console.error(
      `[Meta CAPI] ${events.map((e) => e.event_name).join(",")} not accepted: ${result.error}` +
        (result.status ? ` (HTTP ${result.status})` : "") +
        (result.fbtraceId ? ` fbtrace_id=${result.fbtraceId}` : ""),
    );
  }
  return result;
}
