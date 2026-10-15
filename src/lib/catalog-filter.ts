// The catalog's filter tabs, kept in the address bar: /catalog?filter=free-trial.
// A link can open the catalog already filtered, and a filtered view can be
// shared or reloaded. Other query params (utm_*, fbclid…) are left alone.

export const CATALOG_FILTER_IDS = ["all", "multirange", "breakout", "free-trial"] as const;
export type CatalogFilterId = (typeof CATALOG_FILTER_IDS)[number];

const PARAM = "filter";

/**
 * The tab a `?filter=` value selects. Anything missing, unknown, or naming a
 * tab with no robots behind it (that tab is not shown) falls back to "all".
 */
export function parseCatalogFilter(
  raw: string | null | undefined,
  hasRobots: (id: CatalogFilterId) => boolean,
): CatalogFilterId {
  const id = (raw ?? "").trim().toLowerCase();
  const known = CATALOG_FILTER_IDS.find((candidate) => candidate === id);
  return known && known !== "all" && hasRobots(known) ? known : "all";
}

/**
 * `search` ("" or "?a=b") with the filter set to `id`, and removed for "all",
 * so the unfiltered catalog keeps its plain URL. Every other param is kept.
 * Returns "" or a string starting with "?".
 */
export function withCatalogFilter(search: string, id: CatalogFilterId): string {
  const params = new URLSearchParams(search);
  if (id === "all") params.delete(PARAM);
  else params.set(PARAM, id);
  const query = params.toString();
  return query ? `?${query}` : "";
}
