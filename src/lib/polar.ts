import { createPolar, type models } from "@polar-sh/sdk/2026-10";

// Polar checkout + webhooks. Env:
//   POLAR_ACCESS_TOKEN    organization access token (polar_oat_…)
//   POLAR_WEBHOOK_SECRET  signing secret of the /api/webhooks/polar endpoint
//   POLAR_SERVER          production | sandbox (default production)
//
// A Polar product maps to a (robot, tier) through metadata: `robot=<slug>` and
// `tier=<tier slug>` set on the product in the Polar dashboard, or passed as
// checkout metadata by /api/checkout/polar. order.paid reads that mapping and
// provisions through provisionSubscription like every other payment path.

type PolarClient = ReturnType<typeof createPolar>;
let client: PolarClient | null = null;

export type PolarOrder = models.Order;

// One client, created on first use so builds without the token still pass.
export function polar(): PolarClient {
  if (!client) {
    const accessToken = process.env.POLAR_ACCESS_TOKEN?.trim();
    if (!accessToken) throw new Error("polar not configured");
    client = createPolar({
      accessToken,
      environment: process.env.POLAR_SERVER === "sandbox" ? "sandbox" : "production",
    });
  }
  return client;
}

function metaString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export interface PolarOrderTarget {
  robotSlug: string;
  tierSlug: string;
  refCode: string | null;
}

// Which (robot, tier) an order buys. Checkout metadata wins over product
// metadata so one Polar product can be sold for several robots if needed.
// Returns null when the order carries no mapping — the caller must refuse it,
// never fall back to a default robot or tier.
export function resolvePolarOrderTarget(
  order: Pick<PolarOrder, "metadata" | "product">,
): PolarOrderTarget | null {
  const meta = { ...(order.product?.metadata ?? {}), ...order.metadata };
  const robotSlug = metaString(meta.robot);
  const tierSlug = metaString(meta.tier);
  if (!robotSlug || !tierSlug) return null;
  return {
    robotSlug: robotSlug.toLowerCase(),
    tierSlug: tierSlug.toLowerCase(),
    refCode: metaString(meta.ref),
  };
}

// External id stored in Order.paygateId. provisionSubscription dedupes on it,
// so a redelivered order.paid is a no-op. Keyed on the checkout when there is
// one: the success URL carries {CHECKOUT_ID}, so the thank-you page can poll
// /api/paygate/order-status with the same reference.
export function polarOrderRef(order: Pick<PolarOrder, "id" | "checkout_id">): string {
  return `POLAR-${order.checkout_id ?? order.id}`;
}

export function polarCheckoutRef(checkoutId: string): string {
  return `POLAR-${checkoutId}`;
}

// Polar amounts are integer cents in a lowercase currency; Order.amount is a
// float in an uppercase currency. net_amount is what the buyer paid before
// tax (after discounts), which is what commissions are computed on.
export function polarOrderAmount(
  order: Pick<PolarOrder, "net_amount" | "currency">,
): { amount: number; currency: string } {
  return { amount: order.net_amount / 100, currency: order.currency.toUpperCase() };
}
