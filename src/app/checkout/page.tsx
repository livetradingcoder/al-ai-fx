"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type TierId = "free-trial" | "1-month" | "6-months" | "lifetime" | "secret-test";

function CheckoutContent() {
  const searchParams = useSearchParams();
  const tier = (searchParams?.get("tier") || "1-month") as TierId;

  const [email, setEmail] = useState("");
  const [mt5Account, setMt5Account] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const planDetails = {
    "free-trial": { name: "3-Day Free Trial", price: "$0", amount: "0.00" },
    "1-month": { name: "Monthly Plan", price: "$149", amount: "149.00" },
    "6-months": { name: "Biannual Plan", price: "$499", amount: "499.00" },
    "lifetime": { name: "Lifetime Access", price: "$999", amount: "999.00" },
    "secret-test": { name: "Secret Test Tier", price: "$10", amount: "10.00" },
  };

  const selectedPlan = planDetails[tier] || planDetails["1-month"];
  const isFreeTrial = tier === "free-trial";

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
          mt5AccountNumber: mt5Account.trim() || undefined,
        }),
      });

      const data = (await response.json()) as { checkoutUrl?: string; error?: string };

      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error || "Unable to initialize Paygate checkout.");
      }

      window.location.assign(data.checkoutUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected checkout error.";
      setCheckoutError(message);
      setIsSubmitting(false);
    }
  }

  return (
    <main className="main-content" style={{ maxWidth: "1000px", margin: "0 auto", padding: "6rem 2rem" }}>
      <div style={{ textAlign: "center", marginBottom: "3rem" }}>
        <h1 style={{ fontSize: "3rem", marginBottom: "1rem" }}>Secure Checkout</h1>
        <p style={{ color: "var(--text-secondary)" }}>Complete your purchase to access GoldBot instantly.</p>
      </div>

      <div className="checkout-grid">
        <div className="glass-panel">
          <h2 style={{ fontSize: "1.5rem", marginBottom: "2rem" }}>Account & Payment Details</h2>
          {isSuccess ? (
            <div style={{ textAlign: "center", padding: "2rem 0" }}>
              <div
                style={{
                  fontSize: "4rem",
                  marginBottom: "1.5rem",
                  background: "linear-gradient(135deg, #4ade80, #22c55e)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  display: "inline-block"
                }}
              >
                ✓
              </div>
              <h2 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Account Activated!</h2>
              <p style={{ color: "var(--text-secondary)", marginBottom: "2rem", lineHeight: "1.6" }}>
                Success! Your GoldBot access is now active. We've sent an email to <strong>{email}</strong> with your login credentials and getting-started guide.
              </p>

              <div style={{ background: "var(--bg-secondary)", padding: "1.5rem", borderRadius: "1rem", border: "1px solid var(--border-color)", marginBottom: "2rem" }}>
                <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                  <strong>Next Step:</strong> Check your inbox (and spam folder). Log in with your temporary password to access your dashboard and download your EA.
                </p>
              </div>

              <a
                href="/login"
                className="btn-primary fill"
                style={{ display: "inline-block", textDecoration: "none", width: "100%" }}
              >
                Go to Login
              </a>
            </div>
          ) : (
            <form
              style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
              onSubmit={(event) => {
                event.preventDefault();
                void handlePaygateRedirect();
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Email Address</label>
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

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                  MetaTrader 5 Account Number (Optional now)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 12345678"
                  value={mt5Account}
                  onChange={(event) => setMt5Account(event.target.value)}
                  style={{
                    padding: "1rem",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    fontFamily: "inherit",
                  }}
                />
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  You can set this in your Dashboard later.
                </span>
              </div>

              <hr style={{ border: "none", borderTop: "1px solid var(--border-color)", margin: "1rem 0" }} />

              <div
                style={{
                  background: "var(--bg-secondary)",
                  padding: "1.5rem",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <h3 style={{ fontSize: "1rem", marginBottom: "1rem", display: "flex", justifyContent: "space-between" }}>
                  <span>Paygate Integration</span>
                  <span style={{ color: "var(--accent-accent)" }}>🔒 Secure</span>
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "1rem" }}>
                  {isFreeTrial
                    ? "Click below to instantly activate your 3-day trial. No credit card required."
                    : "Clicking confirm will redirect you to Paygate.to to securely process your crypto or fiat payment."}
                </p>

                {!isFreeTrial && (
                  <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: "0.85rem" }}>
                    Currency: USD | Amount: {selectedPlan.amount}
                  </p>
                )}

                {checkoutError && (
                  <p style={{ color: "#fca5a5", fontSize: "0.85rem", marginBottom: "0.75rem" }}>{checkoutError}</p>
                )}

                <button
                  type="submit"
                  className="btn-primary fill"
                  style={{ border: "none", margin: "0", opacity: isSubmitting ? 0.75 : 1 }}
                  disabled={isSubmitting}
                >
                  {isFreeTrial ? "Start Free Trial" : isSubmitting ? "Redirecting..." : "Proceed to Paygate.to"}
                </button>
              </div>
            </form>
          )}
        </div>

        <div>
          <div className="feature-card" style={{ position: "sticky", top: "100px" }}>
            <h3 style={{ marginBottom: "1.5rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "1rem" }}>
              Order Summary
            </h3>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
              <span style={{ color: "var(--text-secondary)" }}>Plan</span>
              <span style={{ fontWeight: "bold" }}>{selectedPlan.name}</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
              <span style={{ color: "var(--text-secondary)" }}>Product</span>
              <span>GoldBot EA</span>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid var(--border-color)", margin: "1.5rem 0" }} />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "1.5rem",
                fontWeight: "bold",
                fontFamily: "Outfit, sans-serif",
              }}
            >
              <span>Total</span>
              <span style={{ color: "var(--accent-primary)" }}>{selectedPlan.price}</span>
            </div>

            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center", marginTop: "1.5rem" }}>
              Auto-renews unless cancelled. Lifetime passes are a one-time payment.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading Checkout...</p>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
