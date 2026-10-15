// Which country an IP address is in, from the GeoLite2 country database that
// ships inside the geoip-country package. It is a local file read: the address
// never leaves our server. The module is loaded on first use, so the roughly
// 8 MB of data costs nothing for requests that never need it.
//
// Country-level only, and an approximation - VPNs, mobile carriers and anycast
// ranges (1.1.1.1) land elsewhere or nowhere. Good enough to notice that
// "three accounts, one network" is also "three countries", not to prove anything.

type CountryDatabase = { lookup(ip: string): { country: string } | null };

let database: CountryDatabase | null | undefined;

async function load(): Promise<CountryDatabase | null> {
  if (database !== undefined) return database;
  try {
    const mod = await import("geoip-country");
    database = (mod.default ?? mod) as CountryDatabase;
  } catch (err) {
    console.error("[geo] country database unavailable:", err instanceof Error ? err.message : err);
    database = null;
  }
  return database;
}

/** ISO 3166-1 alpha-2 code (e.g. "DE"), or null when the address isn't in the database. */
export async function countryOfIp(ip: string): Promise<string | null> {
  const db = await load();
  if (!db) return null;
  try {
    const found = db.lookup(ip);
    return found?.country && /^[A-Z]{2}$/.test(found.country) ? found.country : null;
  } catch {
    return null;
  }
}

const REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region" });
const REGION_SHORT_NAMES = new Intl.DisplayNames(["en"], { type: "region", style: "short" });

/** "DE" -> "Germany". Falls back to the code for anything the runtime doesn't know. */
export function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  try {
    return REGION_NAMES.of(code) ?? code;
  } catch {
    return code;
  }
}

/** The same in the short form where there is one: "US" -> "US", "GB" -> "UK", "DE" -> "Germany". For tight table cells. */
export function countryShortName(code: string | null | undefined): string | null {
  if (!code) return null;
  try {
    return REGION_SHORT_NAMES.of(code) ?? countryName(code);
  } catch {
    return code;
  }
}
