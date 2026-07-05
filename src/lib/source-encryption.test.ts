import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "crypto";

// Deterministic throwaway key for the test process (getKey reads process.env lazily).
process.env.SOURCE_ENCRYPTION_KEY = randomBytes(32).toString("hex");

import { encryptSource, decryptSource } from "./source-encryption";

test("encrypt→decrypt round-trips to original bytes", () => {
  const plain = Buffer.from(
    "//+------------------+\n// GoldBot EA source\nint OnInit(){return 0;}\n",
    "utf8",
  );
  const enc = encryptSource(plain);
  assert.notDeepEqual(enc, plain); // actually encrypted
  assert.deepEqual(decryptSource(enc), plain); // recovers original
});

test("encrypted layout is [12 IV][16 tag][ct] and IV is random per call", () => {
  const plain = Buffer.from("abc", "utf8");
  const a = encryptSource(plain);
  const b = encryptSource(plain);
  assert.equal(a.length, 12 + 16 + plain.length); // exact layout size
  assert.notDeepEqual(a.subarray(0, 12), b.subarray(0, 12)); // distinct IVs
});

test("decryptSource throws on tampered ciphertext (GCM auth failure)", () => {
  const enc = encryptSource(Buffer.from("secret source", "utf8"));
  const tampered = Buffer.from(enc);
  tampered[tampered.length - 1] ^= 0xff; // flip last ct byte
  assert.throws(() => decryptSource(tampered));
});

test("getKey fails closed when key missing or wrong length", () => {
  const saved = process.env.SOURCE_ENCRYPTION_KEY;
  try {
    delete process.env.SOURCE_ENCRYPTION_KEY;
    assert.throws(() => encryptSource(Buffer.from("x")), /missing/);
    process.env.SOURCE_ENCRYPTION_KEY = "abcd"; // too short
    assert.throws(() => encryptSource(Buffer.from("x")), /32 bytes/);
  } finally {
    process.env.SOURCE_ENCRYPTION_KEY = saved;
  }
});
