import { CONSENT_COOKIE } from "@/lib/consent";
import { cleanClientIp, fbcFromUrl, isValidFbc, isValidFbp, parseCookies, roundMoney } from "@/lib/meta-capi";
import type { MetaCustomData } from "@/lib/meta-shared";

/**
 * What the visitor's own request tells us for Meta: who they are to Meta's
 * matching (IP, user agent, the _fbp/_fbc cookies), which page they were on, and
 * whether they accepted advertising cookies.
 *
 * Consent is the one that decides everything else. The banner mirrors the
 * visitor's choice into a cookie; without "granted" nothing here is stored or
 * sent to Meta, the same rule the browser pixel follows.
 */
export type MetaRequestContext = {
  consent: boolean;
  ip?: string;
  userAgent?: string;
  fbp?: string;
  fbc?: string;
  sourceUrl?: string;
};

const MAX_URL_LENGTH = 1000;

function siteHosts(req: Request) {
  const hosts = new Set<string>();
  try {
    hosts.add(new URL(req.url).hostname);
  } catch {}
  const host = req.headers.get("host");
  if (host) hosts.add(host.split(":")[0]);
  try {
    if (process.env.NEXTAUTH_URL) hosts.add(new URL(process.env.NEXTAUTH_URL).hostname);
  } catch {}
  return hosts;
}

/**
 * A page URL we are willing to report as the event source: http(s), on this
 * site (the request's own host, NEXTAUTH_URL, or al-ai-fx.xyz), without the
 * fragment. Anything else is refused rather than forwarded to Meta.
 */
export function sanitizeSourceUrl(req: Request, raw: string | null | undefined) {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    const ours =
      siteHosts(req).has(url.hostname) ||
      url.hostname === "al-ai-fx.xyz" ||
      url.hostname.endsWith(".al-ai-fx.xyz");
    if (!ours) return undefined;
    url.hash = "";
    const clean = url.toString();
    return clean.length <= MAX_URL_LENGTH ? clean : clean.slice(0, MAX_URL_LENGTH);
  } catch {
    return undefined;
  }
}

export function readMetaRequestContext(
  req: Request,
  options: { sourceUrl?: string | null; nowMs?: number } = {},
): MetaRequestContext {
  // Called on the checkout and trial routes: whatever goes wrong here, those
  // routes must carry on, and "no consent" is the answer that sends nothing.
  try {
    return readContext(req, options);
  } catch {
    return { consent: false };
  }
}

function readContext(
  req: Request,
  options: { sourceUrl?: string | null; nowMs?: number },
): MetaRequestContext {
  const cookies = parseCookies(req.headers.get("cookie"));
  const sourceUrl =
    sanitizeSourceUrl(req, options.sourceUrl) ?? sanitizeSourceUrl(req, req.headers.get("referer"));

  const fbp = cookies._fbp;
  const fbc = cookies._fbc;
  const forwarded = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip");

  return {
    consent: cookies[CONSENT_COOKIE] === "granted",
    ip: cleanClientIp(forwarded),
    userAgent: req.headers.get("user-agent")?.trim().slice(0, 512) || undefined,
    fbp: isValidFbp(fbp) ? fbp : undefined,
    // The pixel's cookie when there is one; otherwise Meta's documented
    // fallback of building it from the fbclid in the page URL.
    fbc: isValidFbc(fbc) ? fbc : fbcFromUrl(sourceUrl, options.nowMs),
    sourceUrl,
  };
}

/**
 * The event properties the page may report. Everything is checked and the rest
 * dropped: the page is untrusted, and what it sends ends up in an ad account.
 */
export function sanitizeCustomData(input: unknown): MetaCustomData {
  const d = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: MetaCustomData = {};

  if (typeof d.value === "number" && Number.isFinite(d.value) && d.value >= 0 && d.value <= 100_000) {
    out.value = roundMoney(d.value);
  }
  if (typeof d.currency === "string" && /^[A-Za-z]{3}$/.test(d.currency)) {
    out.currency = d.currency.toUpperCase();
  }
  if (Array.isArray(d.content_ids)) {
    const ids = d.content_ids
      .filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 100)
      .slice(0, 10);
    if (ids.length) out.content_ids = ids;
  }
  if (d.content_type === "product" || d.content_type === "product_group") out.content_type = d.content_type;
  if (typeof d.content_name === "string" && d.content_name.trim()) out.content_name = d.content_name.slice(0, 200);
  if (typeof d.content_category === "string" && d.content_category.trim()) {
    out.content_category = d.content_category.slice(0, 100);
  }
  if (typeof d.num_items === "number" && Number.isInteger(d.num_items) && d.num_items >= 0 && d.num_items <= 100) {
    out.num_items = d.num_items;
  }
  return out;
}
