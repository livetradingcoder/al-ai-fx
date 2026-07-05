import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import { verifyPaygateSignature } from "./webhook-signature";

/**
 * Snapshot/restore the env keys this module reads so tests are order-independent.
 */
function withEnv(
  overrides: Record<string, string | undefined>,
  fn: () => void,
): void {
  const keys = ["PAYGATE_WEBHOOK_SECRET", "NODE_ENV", "PAYGATE_ALLOW_INSECURE_WEBHOOK"];
  const snapshot: Record<string, string | undefined> = {};
  for (const key of keys) snapshot[key] = process.env[key];

  try {
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fn();
  } finally {
    for (const key of keys) {
      if (snapshot[key] === undefined) delete process.env[key];
      else process.env[key] = snapshot[key];
    }
  }
}

const SECRET = "test-secret-value";
const PAYLOAD = "order-123me@example.comlifetime79999";
const GOOD_SIG = createHmac("sha256", SECRET).update(PAYLOAD).digest("hex");

test("missing secret in production => fail-closed (no-secret)", () => {
  withEnv(
    {
      PAYGATE_WEBHOOK_SECRET: undefined,
      NODE_ENV: "production",
      PAYGATE_ALLOW_INSECURE_WEBHOOK: "1",
    },
    () => {
      const result = verifyPaygateSignature(PAYLOAD, GOOD_SIG);
      assert.deepEqual(result, { ok: false, reason: "no-secret" });
    },
  );
});

test("missing secret in production WITH bypass flag still fails (bypass flag alone is not enough)", () => {
  withEnv(
    {
      PAYGATE_WEBHOOK_SECRET: undefined,
      NODE_ENV: "production",
      PAYGATE_ALLOW_INSECURE_WEBHOOK: "1",
    },
    () => {
      const result = verifyPaygateSignature(PAYLOAD, null);
      assert.equal(result.ok, false);
      assert.equal((result as { reason: string }).reason, "no-secret");
    },
  );
});

test("missing secret in dev WITHOUT bypass flag still fails (dev alone is not enough)", () => {
  withEnv(
    {
      PAYGATE_WEBHOOK_SECRET: undefined,
      NODE_ENV: "development",
      PAYGATE_ALLOW_INSECURE_WEBHOOK: undefined,
    },
    () => {
      const result = verifyPaygateSignature(PAYLOAD, null);
      assert.deepEqual(result, { ok: false, reason: "no-secret" });
    },
  );
});

test("dev bypass requires BOTH keys => ok:true", () => {
  withEnv(
    {
      PAYGATE_WEBHOOK_SECRET: undefined,
      NODE_ENV: "development",
      PAYGATE_ALLOW_INSECURE_WEBHOOK: "1",
    },
    () => {
      const result = verifyPaygateSignature(PAYLOAD, null);
      assert.deepEqual(result, { ok: true });
    },
  );
});

test("secret present, no signature => no-signature", () => {
  withEnv(
    { PAYGATE_WEBHOOK_SECRET: SECRET, NODE_ENV: "production", PAYGATE_ALLOW_INSECURE_WEBHOOK: undefined },
    () => {
      assert.deepEqual(verifyPaygateSignature(PAYLOAD, null), {
        ok: false,
        reason: "no-signature",
      });
      assert.deepEqual(verifyPaygateSignature(PAYLOAD, undefined), {
        ok: false,
        reason: "no-signature",
      });
      assert.deepEqual(verifyPaygateSignature(PAYLOAD, ""), {
        ok: false,
        reason: "no-signature",
      });
    },
  );
});

test("secret present, wrong-length signature => bad-length (defeats timingSafeEqual throw)", () => {
  withEnv(
    { PAYGATE_WEBHOOK_SECRET: SECRET, NODE_ENV: "production", PAYGATE_ALLOW_INSECURE_WEBHOOK: undefined },
    () => {
      assert.deepEqual(verifyPaygateSignature(PAYLOAD, "deadbeef"), {
        ok: false,
        reason: "bad-length",
      });
    },
  );
});

test("secret present, right-length but wrong signature => bad-signature", () => {
  withEnv(
    { PAYGATE_WEBHOOK_SECRET: SECRET, NODE_ENV: "production", PAYGATE_ALLOW_INSECURE_WEBHOOK: undefined },
    () => {
      // Same length as GOOD_SIG (64 hex chars) but wrong content.
      const wrong = "f".repeat(GOOD_SIG.length);
      assert.notEqual(wrong, GOOD_SIG);
      assert.deepEqual(verifyPaygateSignature(PAYLOAD, wrong), {
        ok: false,
        reason: "bad-signature",
      });
    },
  );
});

test("secret present, correct signature => ok:true", () => {
  withEnv(
    { PAYGATE_WEBHOOK_SECRET: SECRET, NODE_ENV: "production", PAYGATE_ALLOW_INSECURE_WEBHOOK: undefined },
    () => {
      assert.deepEqual(verifyPaygateSignature(PAYLOAD, GOOD_SIG), { ok: true });
    },
  );
});
