"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import {
  storePendingCheckout,
  trackBeginCheckout,
  trackViewContent,
} from "@/lib/marketing-client";
import { buildCheckoutThankYouPath } from "@/lib/marketing";
import { TierId, PRICING_TIERS } from "@/config/pricing";

type RobotInfo = {
  slug: string;
  name: string;
  shortDescription: string;
  artworkUrl: string | null;
  prices: Record<string, number>;
};

// Display order for tier chips; only tiers with an active RobotPrice row
// for the selected robot are rendered.
const TIER_ORDER: TierId[] = [
  "free-trial",
  "10-days",
  "1-month",
  "6-months",
  "1-year",
  "lifetime",
  "lifetime-source",
  "secret-test",
];

function formatUsd(amount: number): string {
  return amount === 0
    ? "$0"
    : `$${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function CheckoutContent() {
  const t = useTranslations("Checkout");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const urlTier = (searchParams?.get("tier") || "1-month") as TierId;
  const urlRobot = searchParams?.get("robot") || "";
  const robotNameParam = searchParams?.get("name") || "your robot";

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Robot + plan selection live in checkout so buyers can switch here.
  // Display prices come from the DB (per robot); the charge amount stays
  // server-authoritative in create-session (fail-closed resolveRobotPrice).
  const [tier, setTier] = useState<TierId>(urlTier);
  const [robots, setRobots] = useState<RobotInfo[] | null>(null);
  const [selectedSlug, setSelectedSlug] = useState(urlRobot);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/robots")
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { robots: RobotInfo[] };
        if (cancelled || !Array.isArray(data.robots)) return;
        // Only purchasable robots (>=1 active price) belong in the picker;
        // "coming soon" robots have zero active price rows.
        const purchasable = data.robots.filter(
          (r) => Object.keys(r.prices).length > 0
        );
        setRobots(purchasable);
        if (!purchasable.some((r) => r.slug === urlRobot)) {
          setSelectedSlug(purchasable[0]?.slug ?? "");
        }
      })
      .catch(() => {
        // List unavailable: keep URL params, legacy static display below.
      });
    return () => {
      cancelled = true;
    };
  }, [urlRobot]);

  const robot = robots?.find((r) => r.slug === selectedSlug) ?? null;
  const availableTiers = robot
    ? TIER_ORDER.filter((id) => robot.prices[id] !== undefined)
    : [];

  // Selected robot doesn't offer the current tier -> hop to its first
  // available tier instead of dead-ending (create-session would reject it).
  useEffect(() => {
    if (robot && robot.prices[tier] === undefined && availableTiers.length > 0) {
      setTier(availableTiers.find((id) => robot.prices[id] > 0) ?? availableTiers[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [robot, tier]);

  const planDetails: Record<string, { name: string }> = {
    "free-trial": { name: "3-Day Free Trial" },
    "10-days": { name: t("plan10Days", { fallback: "10-Day Plan" }) },
    "1-month": { name: t("plan1Month", { fallback: "Monthly Plan" }) },
    "6-months": { name: t("plan6Months", { fallback: "Biannual Plan" }) },
    "1-year": { name: t("plan1Year", { fallback: "Yearly Plan" }) },
    lifetime: { name: t("planLifetime", { fallback: "Lifetime Access" }) },
    "lifetime-source": { name: t("planLifetimeSource", { fallback: "Lifetime + Source" }) },
    "secret-test": { name: "Secret Test Tier" },
  };

  const displayAmount =
    robot && robot.prices[tier] !== undefined
      ? robot.prices[tier]
      : PRICING_TIERS[tier]?.amount ?? PRICING_TIERS["1-month"].amount;

  const selectedPlan = {
    name: planDetails[tier]?.name ?? planDetails["1-month"].name,
    price: formatUsd(displayAmount),
    amount: displayAmount.toFixed(2),
  };
  const robotName = robot?.name ?? robotNameParam;
  const isFreeTrial = tier === "free-trial";

  async function openThankYouFlow(input: {
    amount: number;
    checkoutUrl: string;
    currency: string;
    orderRef: string;
    tier: TierId;
  }) {
    storePendingCheckout({
      amount: input.amount,
      checkoutUrl: input.checkoutUrl,
      currency: input.currency,
      orderRef: input.orderRef,
      tier: input.tier,
    });

    trackBeginCheckout({
      amount: input.amount,
      currency: input.currency,
      orderRef: input.orderRef,
      tier: input.tier,
    });

    window.location.assign(buildCheckoutThankYouPath(locale, input.orderRef));
  }

  async function handlePaygateRedirect() {
    if (!email.trim() || !email.includes("@")) {
      setCheckoutError("Please enter a valid email before continuing.");
      return;
    }

    setIsSubmitting(true);
    setCheckoutError(null);

    try {
      if (isFreeTrial) {
        const response = await fetch("/api/checkout/free-trial", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            robotSlug: selectedSlug,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to activate free trial.");
        }

        setIsSubmitting(false);
        setIsSuccess(true);
        return;
      }

      const response = await fetch("/api/paygate/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          email: email.trim().toLowerCase(),
          currency: "USD",
          robotSlug: selectedSlug,
        }),
      });

      const data = (await response.json()) as {
        amount?: number | string;
        checkoutUrl?: string;
        currency?: string;
        error?: string;
        orderRef?: string;
      };

      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error || "Unable to initialize Paygate checkout.");
      }

      const orderRef = "orderRef" in data && typeof data.orderRef === "string" ? data.orderRef : "";
      const amount = "amount" in data ? Number.parseFloat(String(data.amount)) : Number.NaN;
      const currency = "currency" in data && typeof data.currency === "string" ? data.currency : "USD";

      if (!orderRef || Number.isNaN(amount)) {
        throw new Error("Unable to create a valid checkout session.");
      }

      await openThankYouFlow({
        amount,
        checkoutUrl: data.checkoutUrl,
        currency,
        orderRef,
        tier,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected checkout error.";
      setCheckoutError(message);
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    trackViewContent({
      contentName: selectedPlan.name,
      contentType: "checkout",
      currency: "USD",
      value: Number.parseFloat(selectedPlan.amount),
    });
  }, [selectedPlan.amount, selectedPlan.name]);

  return (
    <main
      className="main-content"
      style={{ maxWidth: "1000px", margin: "0 auto", padding: "6rem 2rem" }}
    >
      <div style={{ textAlign: "center", marginBottom: "3rem" }}>
        <h1 style={{ fontSize: "3rem", marginBottom: "1rem" }}>{t("secureCheckout")}</h1>
        <p style={{ color: "var(--text-secondary)" }}>{t("checkoutSubtitle")}</p>
      </div>

      <div className="checkout-grid">
        <div className="glass-panel">
          <h2 style={{ fontSize: "1.5rem", marginBottom: "2rem" }}>
            {t("accPaymentDetails")}
          </h2>
          {isSuccess ? (
            <div style={{ textAlign: "center", padding: "2rem 0" }}>
              <div
                style={{
                  fontSize: "4rem",
                  marginBottom: "1.5rem",
                  background: "linear-gradient(135deg, #4ade80, #22c55e)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  display: "inline-block",
                }}
              >
                ✓
              </div>
              <h2 style={{ fontSize: "2rem", marginBottom: "1rem" }}>
                {t("accountActivated")}
              </h2>
              <p
                style={{
                  color: "var(--text-secondary)",
                  marginBottom: "2rem",
                  lineHeight: "1.6",
                }}
              >
                Your {robotName} access is active. We sent a secure dashboard sign-in link to{" "}
                <strong>{email}</strong>.
              </p>

              <div
                style={{
                  background: "var(--bg-secondary)",
                  padding: "1.5rem",
                  borderRadius: "1rem",
                  border: "1px solid var(--border-color)",
                  marginBottom: "2rem",
                }}
              >
                <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                  <strong>{t("nextStep")}</strong> Check your inbox and spam folder, then use the magic link in the email to open your dashboard securely.
                </p>
              </div>

              <Link
                href="/"
                className="btn-primary fill"
                style={{ display: "inline-block", textDecoration: "none", width: "100%" }}
              >
                Back to home
              </Link>
            </div>
          ) : (
            <form
              className="checkout-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handlePaygateRedirect();
              }}
            >
              {robots && robots.length > 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <label style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                    Choose your robot
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {robots.map((r) => {
                      const active = r.slug === selectedSlug;
                      return (
                        <button
                          key={r.slug}
                          type="button"
                          onClick={() => setSelectedSlug(r.slug)}
                          style={{
                            padding: "0.6rem 1rem",
                            borderRadius: "999px",
                            border: active
                              ? "1px solid var(--accent-primary)"
                              : "1px solid var(--border-color)",
                            background: active
                              ? "var(--accent-primary)"
                              : "var(--bg-secondary)",
                            color: active ? "#000" : "var(--text-primary)",
                            fontWeight: active ? 700 : 500,
                            fontSize: "0.85rem",
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          {r.name}
                        </button>
                      );
                    })}
                  </div>
                  {robot?.shortDescription && (
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0 }}>
                      {robot.shortDescription}
                    </p>
                  )}
                </div>
              )}

              {robot && availableTiers.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <label style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                    Plan
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {availableTiers.map((id) => {
                      const active = id === tier;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setTier(id)}
                          style={{
                            padding: "0.6rem 1rem",
                            borderRadius: "var(--radius-sm)",
                            border: active
                              ? "1px solid var(--accent-primary)"
                              : "1px solid var(--border-color)",
                            background: "var(--bg-secondary)",
                            color: active ? "var(--accent-primary)" : "var(--text-primary)",
                            fontWeight: active ? 700 : 500,
                            fontSize: "0.85rem",
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          {planDetails[id]?.name ?? id} · {formatUsd(robot.prices[id])}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                  {t("emailAddress")}
                </label>
                <input
                  type="email"
                  placeholder="you@domain.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  style={{
                    padding: "1rem",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <div className="checkout-inline-note">
                <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", margin: 0 }}>
                  {t("setMt5Later")}
                </p>
              </div>

              <hr
                style={{
                  border: "none",
                  borderTop: "1px solid var(--border-color)",
                  margin: "1rem 0",
                }}
              />

              <div className="checkout-action-panel">
                <div className="checkout-provider-chip">
                  <span aria-hidden="true">★</span>
                  <span>Supported by Paygate</span>
                </div>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "0.9rem",
                    marginBottom: "0.85rem",
                  }}
                >
                  {isFreeTrial ? t("freeTrialAction") : t("paygateRedirect")}
                </p>

                {!isFreeTrial && (
                  <p
                    style={{
                      color: "var(--text-muted)",
                      fontSize: "0.8rem",
                      marginBottom: "0.85rem",
                    }}
                  >
                    Currency: USD | Amount: {selectedPlan.amount}
                  </p>
                )}

                {checkoutError && (
                  <p style={{ color: "#fca5a5", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
                    {checkoutError}
                  </p>
                )}

                <button
                  type="submit"
                  className="btn-primary fill"
                  style={{ border: "none", margin: "0.25rem 0 0", opacity: isSubmitting ? 0.75 : 1 }}
                  disabled={isSubmitting}
                >
                  {isFreeTrial
                    ? t("startFreeTrial")
                    : isSubmitting
                      ? t("redirecting")
                      : t("proceedToPaygate")}
                </button>
              </div>
            </form>
          )}
        </div>

        <div>
          <div className="feature-card" style={{ position: "sticky", top: "100px" }}>
            <h3
              style={{
                marginBottom: "1.5rem",
                borderBottom: "1px solid var(--border-color)",
                paddingBottom: "1rem",
              }}
            >
              {t("orderSummary")}
            </h3>

            <div
              style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}
            >
              <span style={{ color: "var(--text-secondary)" }}>{t("plan")}</span>
              <span style={{ fontWeight: "bold" }}>{selectedPlan.name}</span>
            </div>

            <div
              style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}
            >
              <span style={{ color: "var(--text-secondary)" }}>{t("product")}</span>
              <span>{robotName}</span>
            </div>

            <hr
              style={{
                border: "none",
                borderTop: "1px solid var(--border-color)",
                margin: "1.5rem 0",
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "1.5rem",
                fontWeight: "bold",
                fontFamily: "Outfit, sans-serif",
              }}
            >
              <span>{t("total")}</span>
              <span style={{ color: "var(--accent-primary)" }}>{selectedPlan.price}</span>
            </div>

            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                textAlign: "center",
                marginTop: "1.5rem",
              }}
            >
              {t("autoRenews")}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function CheckoutClient() {
  const t = useTranslations("Checkout");

  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "80vh",
          }}
        >
          <p style={{ color: "var(--text-secondary)" }}>{t("loadingCheckout")}</p>
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
