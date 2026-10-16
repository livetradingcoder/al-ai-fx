import { ipFromHeaders, isPublicIp } from "@/lib/client-ip";
import { countryOfIp } from "@/lib/geo-country";

// Promotions (the giveaway, the share-for-discount reward, public display of
// results) are not offered in countries or languages where promoting retail
// forex products is restricted. Enforced on the server for every promo
// endpoint - hiding a button is not a gate.
//
// Countries come from PROMO_BLOCKED_COUNTRIES (comma separated ISO codes). The
// country gate is OFF by default: nothing is blocked unless that variable lists
// countries (for example PROMO_BLOCKED_COUNTRIES=PK,IN). The language gate below
// is separate and always on.

export const DEFAULT_BLOCKED_COUNTRIES: readonly string[] = [];

/** Languages whose audiences are the restricted markets; mirrors the school's ROBOT_SAFE_LOCALES inverse. */
export const BLOCKED_LOCALES = ["ar", "hi", "ur", "bn"] as const;

export function blockedCountries(env: string | undefined = process.env.PROMO_BLOCKED_COUNTRIES): Set<string> {
  if (env === undefined) return new Set(DEFAULT_BLOCKED_COUNTRIES);
  return new Set(
    env
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter((c) => /^[A-Z]{2}$/.test(c)),
  );
}

export function isPromoBlockedCountry(
  code: string | null | undefined,
  blocked: Set<string> = blockedCountries(),
): boolean {
  return !!code && blocked.has(code.toUpperCase());
}

export function isPromoBlockedLocale(locale: string | null | undefined): boolean {
  return !!locale && (BLOCKED_LOCALES as readonly string[]).includes(locale.toLowerCase());
}

export type PromoEligibility = {
  eligible: boolean;
  country: string | null;
  reason?: "country" | "locale";
};

/**
 * Whether the person behind this request may be offered promotions. An
 * address we can't place (private network, not in the database) is allowed:
 * blocking on "unknown" would shut out people on mobile networks for no
 * reason, and the locale check still applies.
 */
export async function promoEligibilityForRequest(
  req: Request,
  locale?: string | null,
): Promise<PromoEligibility> {
  if (isPromoBlockedLocale(locale)) return { eligible: false, country: null, reason: "locale" };

  const ip = ipFromHeaders((name) => req.headers.get(name));
  const country = ip && isPublicIp(ip) ? await countryOfIp(ip) : null;
  if (isPromoBlockedCountry(country)) return { eligible: false, country, reason: "country" };
  return { eligible: true, country };
}
