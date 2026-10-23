"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/action-result";
import { DEFAULT_SWITCHES, PAYMENT_PROVIDERS, PROVIDER_LABELS, type PaymentProvider } from "@/lib/payment-settings";

const FIELD: Record<PaymentProvider, "polarEnabled" | "whopEnabled" | "oxapayEnabled"> = {
  polar: "polarEnabled",
  whop: "whopEnabled",
  oxapay: "oxapayEnabled",
};

export async function setProviderEnabled(provider: PaymentProvider, enabled: boolean): Promise<ActionResult> {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") return { ok: false, error: "Admins only" };
  if (!PAYMENT_PROVIDERS.includes(provider)) return { ok: false, error: "Unknown provider" };

  try {
    await prisma.paymentSettings.upsert({
      where: { id: "default" },
      // A first save stores every switch, so the untouched ones keep their defaults.
      create: {
        id: "default",
        polarEnabled: DEFAULT_SWITCHES.polar,
        whopEnabled: DEFAULT_SWITCHES.whop,
        oxapayEnabled: DEFAULT_SWITCHES.oxapay,
        [FIELD[provider]]: enabled,
      },
      update: { [FIELD[provider]]: enabled },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
      return { ok: false, error: 'The settings table is missing. Run "npx prisma migrate deploy" on the server, then try again.' };
    }
    console.error("[Payments] saving a switch failed:", err);
    return { ok: false, error: "Something went wrong" };
  }

  revalidatePath("/dashboard/admin/payments");
  revalidatePath("/checkout");
  const { name } = PROVIDER_LABELS[provider];
  return { ok: true, message: enabled ? `${name} is switched on.` : `${name} is switched off — checkout no longer offers it.` };
}
