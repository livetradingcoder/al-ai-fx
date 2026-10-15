import test from "node:test";
import assert from "node:assert/strict";

import { ipFromHeaders, isPublicIp, normalizeIp } from "./client-ip";

test("the first address in a forwarding chain is the visitor", () => {
  assert.equal(normalizeIp("8.8.8.8, 10.0.0.2"), "8.8.8.8");
  assert.equal(normalizeIp("  81.2.69.142  "), "81.2.69.142");
  assert.equal(normalizeIp("2001:4860:4860::8888"), "2001:4860:4860::8888");
  assert.equal(normalizeIp("2001:4860:4860::8888, 10.0.0.2"), "2001:4860:4860::8888");
});

test("an IPv4 address wrapped in IPv6 is unwrapped; the case is normalised", () => {
  assert.equal(normalizeIp("::ffff:8.8.8.8"), "8.8.8.8");
  assert.equal(normalizeIp("::FFFF:8.8.8.8"), "8.8.8.8");
  assert.equal(normalizeIp("2001:DB8::1"), "2001:db8::1");
});

test("anything that is not an address is refused, not stored", () => {
  for (const junk of ["", null, undefined, "unknown", "<script>", "8.8.8", "999.1.1.1", "8.8.8.8; DROP TABLE", "'--"]) {
    assert.equal(normalizeIp(junk), null, String(junk));
  }
  assert.equal(normalizeIp("1".repeat(200)), null, "a very long value is cut and then refused");
});

test("the forwarded-for header wins; x-real-ip is the fallback", () => {
  const headers = (h: Record<string, string>) => (name: string) => h[name] ?? null;
  assert.equal(ipFromHeaders(headers({ "x-forwarded-for": "8.8.8.8", "x-real-ip": "1.2.3.4" })), "8.8.8.8");
  assert.equal(ipFromHeaders(headers({ "x-real-ip": "81.2.69.142" })), "81.2.69.142");
  assert.equal(ipFromHeaders(headers({ "x-forwarded-for": "garbage", "x-real-ip": "81.2.69.142" })), "81.2.69.142");
  assert.equal(ipFromHeaders(headers({})), null);
  assert.equal(ipFromHeaders(headers({ "x-forwarded-for": "garbage" })), null);
});

test("public addresses are recognised", () => {
  for (const ip of ["8.8.8.8", "81.2.69.142", "203.0.1.1", "192.0.43.8", "198.51.99.1", "172.15.0.1", "172.32.0.1", "100.63.0.1", "100.128.0.1", "2001:4860:4860::8888", "2a00:1450:4001::1"]) {
    assert.equal(isPublicIp(ip), true, ip);
  }
});

test("private, loopback, shared and documentation addresses are not", () => {
  for (const ip of [
    "0.0.0.0", "10.0.0.1", "127.0.0.1", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.1.1", "100.64.0.1", "100.127.255.255",
    "192.0.2.5", "198.51.100.5", "203.0.113.5", "198.18.0.1", "224.0.0.1", "255.255.255.255",
    "::", "::1", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "2001:db8::1", "not-an-ip", "",
  ]) {
    assert.equal(isPublicIp(ip), false, ip);
  }
});
