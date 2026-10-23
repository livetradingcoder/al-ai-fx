import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { oxapayKey } from "@/lib/oxapay";
import { whopEnabled as whopConfigured } from "@/lib/whop";

// Which payment providers checkout offers, switched on and off from
// Admin → Payments. A provider is offered only when it is switched on AND its
// keys are in the environment: the switch can't conjure a provider that was
// never set up, and a provider that is set up can be paused without touching
// Coolify. Webhooks ignore the switch, so an order paid before a provider was
// switched off is still fulfilled.

export const PAYMENT_PROVIDERS = ["polar", "whop", "oxapay"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export type PaymentSwitches = Record<PaymentProvider, boolean>;

/** Used when the settings row (or, before `migrate deploy`, the table) doesn't exist. */
export const DEFAULT_SWITCHES: PaymentSwitches = { polar: false, whop: true, oxapay: true };

export const PROVIDER_LABELS: Record<PaymentProvider, { name: string; method: string }> = {
  polar: { name: "Polar", method: "Card" },
  whop: { name: "Whop", method: "Card" },
  oxapay: { name: "OxaPay", method: "Crypto" },
};

/** Whether each provider's keys are in the running container's environment. */
export function providerConfigured(): PaymentSwitches {
  return {
    polar: Boolean(process.env.POLAR_ACCESS_TOKEN?.trim()),
    whop: whopConfigured(),
    oxapay: oxapayKey() !== null,
  };
}

/** The admin switches as stored, falling back to the defaults. */
export async function getPaymentSwitches(): Promise<PaymentSwitches> {
  try {
    const row = await prisma.paymentSettings.findUnique({ where: { id: "default" } });
    if (!row) return DEFAULT_SWITCHES;
    return { polar: row.polarEnabled, whop: row.whopEnabled, oxapay: row.oxapayEnabled };
  } catch (err) {
    // P2021: the table isn't there until `prisma migrate deploy` runs. Checkout
    // must keep working in the meantime, on the defaults.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021")) {
      console.error("[Payments] settings lookup failed:", err instanceof Error ? err.message : err);
    }
    return DEFAULT_SWITCHES;
  }
}

/** What checkout actually offers: switched on and configured. */
export async function availableProviders(): Promise<PaymentSwitches> {
  const [switches, configured] = [await getPaymentSwitches(), providerConfigured()];
  return {
    polar: switches.polar && configured.polar,
    whop: switches.whop && configured.whop,
    oxapay: switches.oxapay && configured.oxapay,
  };
}

export async function isProviderAvailable(provider: PaymentProvider): Promise<boolean> {
  return (await availableProviders())[provider];
}

/** The answer a checkout route gives when its provider is switched off. */
export function providerOffMessage(provider: PaymentProvider): string {
  const { name, method } = PROVIDER_LABELS[provider];
  return `${method} payments through ${name} are switched off right now. Choose another way to pay.`;
}
