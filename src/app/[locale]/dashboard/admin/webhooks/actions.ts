"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/action-result";
import {
  SELECTABLE_EVENTS,
  SIGNATURE_FORMATS,
  assertSafeUrl,
  runDelivery,
  sendTestEvent,
} from "@/lib/outbound-webhooks";

/** Null for an admin, otherwise the failure to hand straight back. */
async function requireAdmin(): Promise<ActionResult | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.role === "ADMIN" ? null : { ok: false, error: "Admins only" };
}

function refresh() {
  revalidatePath("/dashboard/admin/webhooks");
}

const MIN_SECRET = 16;

type Input = {
  name: string;
  url: string;
  /** Required when creating; blank when editing means "keep the current one". */
  secret: string;
  events: string[];
  signatureFormat: string;
  enabled: boolean;
};

type Valid = { name: string; url: string; secret: string; events: string[]; signatureFormat: string };

async function validate(input: Input, secretRequired: boolean): Promise<Valid | { error: string }> {
  const name = input.name.trim();
  if (!name) return { error: "Give it a name" };
  if (name.length > 60) return { error: "Keep the name under 60 characters" };

  let url: string;
  try {
    url = (await assertSafeUrl(input.url)).toString();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That URL cannot be used" };
  }

  const secret = input.secret.trim();
  if (secretRequired && !secret) return { error: "Paste the secret from the receiving app" };
  if (secret && secret.length < MIN_SECRET) return { error: `The secret must be at least ${MIN_SECRET} characters` };

  const events = SELECTABLE_EVENTS.filter((e) => input.events.includes(e));
  if (events.length === 0) return { error: "Pick at least one event" };

  const signatureFormat = (SIGNATURE_FORMATS as readonly string[]).includes(input.signatureFormat)
    ? input.signatureFormat
    : "hex";

  return { name, url, secret, events: [...events], signatureFormat };
}

function dbProblem(err: unknown): ActionResult {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
    return { ok: false, error: 'The webhook tables are missing. Run "npx prisma migrate deploy" on the server, then try again.' };
  }
  console.error("[Webhooks] admin action failed:", err);
  return { ok: false, error: "Something went wrong" };
}

export async function createWebhook(input: Input): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const v = await validate(input, true);
  if ("error" in v) return { ok: false, error: v.error };
  try {
    await prisma.outboundWebhook.create({
      data: {
        name: v.name,
        url: v.url,
        secret: v.secret,
        events: v.events,
        signatureFormat: v.signatureFormat,
        enabled: input.enabled,
      },
    });
  } catch (err) {
    return dbProblem(err);
  }
  refresh();
  return { ok: true, message: `Created “${v.name}”. Use “Send test” to check the connection.` };
}

export async function updateWebhook(id: string, input: Input): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const v = await validate(input, false);
  if ("error" in v) return { ok: false, error: v.error };
  try {
    await prisma.outboundWebhook.update({
      where: { id },
      data: {
        name: v.name,
        url: v.url,
        ...(v.secret ? { secret: v.secret } : {}),
        events: v.events,
        signatureFormat: v.signatureFormat,
        enabled: input.enabled,
      },
    });
  } catch (err) {
    return dbProblem(err);
  }
  refresh();
  return { ok: true, message: `Saved “${v.name}”.` };
}

export async function setWebhookEnabled(id: string, enabled: boolean): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    await prisma.outboundWebhook.update({ where: { id }, data: { enabled } });
  } catch (err) {
    return dbProblem(err);
  }
  refresh();
  return { ok: true, message: enabled ? "Switched on." : "Switched off — no events will be sent." };
}

export async function deleteWebhook(id: string): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    await prisma.outboundWebhook.delete({ where: { id } });
  } catch (err) {
    return dbProblem(err);
  }
  refresh();
  return { ok: true, message: "Deleted, along with its delivery log." };
}

const snippet = (text: string | null) => (text ? ` — “${text.replace(/\s+/g, " ").slice(0, 160)}”` : "");

/** Sends one test event to this endpoint now and reports what came back. */
export async function sendWebhookTest(id: string): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const delivery = await sendTestEvent(id);
    refresh();
    if (!delivery) return { ok: false, error: "That webhook no longer exists" };
    if (delivery.status === "DELIVERED") {
      return {
        ok: true,
        message: `Delivered: the receiver answered HTTP ${delivery.httpStatus} in ${delivery.durationMs} ms${snippet(delivery.responseBody)}.`,
      };
    }
    return {
      ok: false,
      error: `Not delivered: ${delivery.error ?? "no response"}${snippet(delivery.responseBody)}. Open the delivery below for details.`,
    };
  } catch (err) {
    return dbProblem(err);
  }
}

/** Sends the same body again, for a delivery that failed. */
export async function redeliverWebhook(deliveryId: string): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    await runDelivery(deliveryId, 1);
    const delivery = await prisma.outboundWebhookDelivery.findUnique({ where: { id: deliveryId } });
    refresh();
    if (!delivery) return { ok: false, error: "That delivery no longer exists" };
    return delivery.status === "DELIVERED"
      ? { ok: true, message: `Delivered on attempt ${delivery.attempts} (HTTP ${delivery.httpStatus}).` }
      : { ok: false, error: `Still failing: ${delivery.error ?? "no response"}${snippet(delivery.responseBody)}` };
  } catch (err) {
    return dbProblem(err);
  }
}
