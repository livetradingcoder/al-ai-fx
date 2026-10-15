import { CATALOG_FILTER_IDS, type CatalogFilterId } from "@/lib/catalog-filter";

// Every share image (the card WhatsApp, Facebook, X and Slack show when a link
// is pasted) is addressed by a small spec that names a page, never by free text:
// /api/og/v1/robot/gold-multirange-4.jpg. The route only accepts values it can
// look up, so the endpoint cannot be used to put arbitrary words on our domain.

/**
 * Part of every image URL. WhatsApp and Facebook cache a preview by its image
 * address, so when a card's design changes, bump this and links shared from
 * then on show the new one.
 */
export const OG_VERSION = "v1";

/** The static pages that get a card of their own, with copy in og-copy.ts. */
export const OG_PAGE_KEYS = [
  "features",
  "guides",
  "roadmap",
  "licensing",
  "affiliates",
  "faq",
  "support",
  "privacy-policy",
  "terms-conditions",
  "refund-policy",
  "disclaimer",
] as const;
export type OgPageKey = (typeof OG_PAGE_KEYS)[number];

export type OgSpec =
  | { type: "robot"; slug: string }
  | { type: "catalog"; filter: CatalogFilterId }
  | { type: "guide"; slug: string }
  | { type: "page"; key: OgPageKey };

const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;

export function isOgPageKey(value: string): value is OgPageKey {
  return (OG_PAGE_KEYS as readonly string[]).includes(value);
}

/** Path part of the image address, e.g. /api/og/v1/catalog/multirange.jpg. */
export function ogImagePath(spec: OgSpec): string {
  const name =
    spec.type === "robot" || spec.type === "guide" ? spec.slug : spec.type === "catalog" ? spec.filter : spec.key;
  return `/api/og/${OG_VERSION}/${spec.type}/${name}.jpg`;
}

/** The spec a request names, or null for anything that is not one of ours. */
export function parseOgSpec(type: string, rawName: string): OgSpec | null {
  const name = rawName.toLowerCase().replace(/\.jpg$/, "");

  switch (type) {
    case "robot":
    case "guide":
      return SLUG.test(name) ? { type, slug: name } : null;
    case "catalog": {
      const filter = CATALOG_FILTER_IDS.find((id) => id === name);
      return filter ? { type: "catalog", filter } : null;
    }
    case "page":
      return isOgPageKey(name) ? { type: "page", key: name } : null;
    default:
      return null;
  }
}
