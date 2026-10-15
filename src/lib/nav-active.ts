/**
 * Whether `pathname` (without its locale prefix) is one of `prefixes` or
 * below it: "/tutorials" matches "/tutorials/free-trial" but not "/tutorials-x".
 */
export function isOnPath(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
