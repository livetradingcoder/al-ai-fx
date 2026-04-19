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

type TierId = "free-trial" | "1-month" | "6-months" | "lifetime" | "secret-test";

function CheckoutContent() {
  const t = useTranslations("Checkout");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const tier = (searchParams?.get("tier") || "1-month") as TierId;

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const planDetails = {
    "free-trial": { name: "3-Day Free Trial", price: "$0", amount: "0.00" },
    "1-month": { name: "Monthly Plan", price: "$149", amount: "149.00" },
    "6-months": { name: "Biannual Plan", price: "$499", amount: "499.00" },
    lifetime: { name: "Lifetime Access", price: "$999", amount: "999.00" },
    "secret-test": { name: "Secret Test Tier", price: "$10", amount: "10.00" },
  };

  const selectedPlan = planDetails[tier] || planDetails["1-month"];
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

    const paymentWindow =
      !isFreeTrial && typeof window !== "undefined"
        ? window.open("", "_blank", "noopener,noreferrer")
        : null;

    try {
      if (isFreeTrial) {
        const response = await fetch("/api/checkout/free-trial", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
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

      if (paymentWindow && !paymentWindow.closed) {
        paymentWindow.location.assign(data.checkoutUrl);
      }

      await openThankYouFlow({
        amount,
        checkoutUrl: data.checkoutUrl,
        currency,
        orderRef,
        tier,
      });
    } catch (error) {
      if (paymentWindow && !paymentWindow.closed) {
        paymentWindow.close();
      }
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
                Your GoldBot access is active. We sent a secure dashboard sign-in link to{" "}
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
              <span>GoldBot EA</span>
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
