import { isIP } from "node:net";

// Reading a visitor's IP address from the headers the proxy in front of the
// app adds. Coolify's Traefik overwrites X-Forwarded-For with the connecting
// address for outside clients, so the first entry is the visitor.

/** "203.0.113.7, 10.0.0.2" -> "203.0.113.7"; strips an IPv4-mapped IPv6 prefix and surrounding junk. */
export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let ip = raw.split(",")[0].trim().slice(0, 64);
  if (ip.toLowerCase().startsWith("::ffff:") && isIP(ip.slice(7)) === 4) ip = ip.slice(7);
  return isIP(ip) ? ip.toLowerCase() : null;
}

/** The visitor's address from forwarding headers, or null when there isn't a usable one. */
export function ipFromHeaders(get: (name: string) => string | null | undefined): string | null {
  return normalizeIp(get("x-forwarded-for")) ?? normalizeIp(get("x-real-ip"));
}

function v4Octets(ip: string): number[] | null {
  const parts = ip.split(".").map(Number);
  return parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? parts : null;
}

/**
 * True for an address a visitor can really have: not loopback, private,
 * link-local, carrier-grade NAT or documentation space. Those only show up
 * when something internal (a health check, a developer's laptop) made the
 * request, and recording them would be noise.
 */
export function isPublicIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) {
    const o = v4Octets(ip);
    if (!o) return false;
    const [a, b, c] = o;
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false; // this-network, private, loopback, multicast and reserved
    if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
    if (a === 169 && b === 254) return false; // link-local
    if (a === 172 && b >= 16 && b <= 31) return false; // private
    if (a === 192 && b === 168) return false; // private
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return false; // IETF protocol assignments, documentation
    if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
    if (a === 198 && b === 51 && c === 100) return false; // documentation
    if (a === 203 && b === 0 && c === 113) return false; // documentation
    return true;
  }
  if (kind === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return false;
    if (/^f[cd]/.test(lower)) return false; // unique local
    if (/^fe[89ab]/.test(lower)) return false; // link-local
    if (lower.startsWith("ff")) return false; // multicast
    if (lower.startsWith("2001:db8")) return false; // documentation
    return true;
  }
  return false;
}
