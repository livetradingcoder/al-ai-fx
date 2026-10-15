import test from "node:test";
import assert from "node:assert/strict";

import { countryName, countryOfIp } from "./geo-country";

test("well-known addresses resolve to their country", async () => {
  assert.equal(await countryOfIp("8.8.8.8"), "US");
  assert.equal(await countryOfIp("81.2.69.142"), "GB");
  assert.equal(await countryOfIp("2001:4860:4860::8888"), "US");
});

test("private, loopback and junk addresses resolve to nothing, without throwing", async () => {
  for (const ip of ["10.0.0.1", "127.0.0.1", "192.168.0.10", "::1", "not-an-ip", ""]) {
    assert.equal(await countryOfIp(ip), null, ip);
  }
});

test("a code becomes a readable name", () => {
  assert.equal(countryName("DE"), "Germany");
  assert.equal(countryName("US"), "United States");
  assert.equal(countryName(null), null);
  assert.equal(countryName(""), null);
});
