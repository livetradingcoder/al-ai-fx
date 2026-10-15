// geoip-country ships no types. This is the one function we use.
declare module "geoip-country" {
  export function lookup(ip: string): { country: string } | null;
  const geoip: { lookup: typeof lookup };
  export default geoip;
}
