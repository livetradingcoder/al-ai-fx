// src/lib/webhook-delivery.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";

type CreateFn = () => Promise<unknown>;

export async function recordWebhookDelivery(
  create: CreateFn,
): Promise<{ firstDelivery: true } | { firstDelivery: false; duplicate: true }> {
  try {
    await create();
    return { firstDelivery: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { firstDelivery: false, duplicate: true };
    }
    throw err;
  }
}

test("first-time delivery: create succeeds → firstDelivery: true", async () => {
  const create: CreateFn = async () => ({ id: "row1" });
  const result = await recordWebhookDelivery(create);
  assert.deepEqual(result, { firstDelivery: true });
});

test("duplicate delivery: P2002 → duplicate: true (SECR-02 replay rejection)", async () => {
  const create: CreateFn = async () => {
    throw new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on the fields: (`signature`)",
      { code: "P2002", clientVersion: "6.19.3", meta: { target: ["signature"] } },
    );
  };
  const result = await recordWebhookDelivery(create);
  assert.deepEqual(result, { firstDelivery: false, duplicate: true });
});

test("non-P2002 Prisma error propagates (do NOT silently return 200)", async () => {
  const create: CreateFn = async () => {
    throw new Prisma.PrismaClientKnownRequestError(
      "Some other DB failure",
      { code: "P2003", clientVersion: "6.19.3" },
    );
  };
  await assert.rejects(() => recordWebhookDelivery(create), Prisma.PrismaClientKnownRequestError);
});

test("non-Prisma errors propagate (do NOT accidentally swallow real crashes)", async () => {
  const create: CreateFn = async () => {
    throw new TypeError("connection lost");
  };
  await assert.rejects(() => recordWebhookDelivery(create), TypeError);
});
