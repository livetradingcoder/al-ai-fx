import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { authOptions } from "@/lib/auth";
import { PAYMENT_PROVIDERS, PROVIDER_LABELS, getPaymentSwitches, providerConfigured } from "@/lib/payment-settings";
import PaymentsAdmin, { type ProviderRow } from "./PaymentsAdmin";

export const metadata = { title: "Payments" };

const ENV_HINT: Record<(typeof PAYMENT_PROVIDERS)[number], string> = {
  polar: "POLAR_ACCESS_TOKEN, POLAR_WEBHOOK_SECRET",
  whop: "WHOP_API_KEY, WHOP_ACCOUNT_ID, WHOP_PRODUCTS_JSON (or WHOP_PRODUCT_ID), WHOP_WEBHOOK_SECRET",
  oxapay: "OXAPAY_MERCHANT_API_KEY",
};

export default async function AdminPaymentsPage() {
  // Whether a provider is configured is read from the running container's env.
  await connection();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") redirect("/dashboard");

  const [switches, configured] = [await getPaymentSwitches(), providerConfigured()];
  const rows: ProviderRow[] = PAYMENT_PROVIDERS.map((id) => ({
    id,
    name: PROVIDER_LABELS[id].name,
    method: PROVIDER_LABELS[id].method,
    enabled: switches[id],
    configured: configured[id],
    envHint: ENV_HINT[id],
  }));

  return (
    <>
      <header style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "2.1rem", marginBottom: "0.35rem" }}>Payments</h1>
        <p style={{ color: "var(--text-secondary)", maxWidth: "72ch" }}>
          Choose which ways to pay checkout offers. Switching a provider off hides its button and stops
          new orders through it straight away; payments already started with it are still fulfilled.
          A provider also needs its keys in the server environment before it can be offered.
        </p>
      </header>
      <PaymentsAdmin providers={rows} />
    </>
  );
}
