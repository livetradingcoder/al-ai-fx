"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Link } from "@/i18n/routing";
import {
  clearPendingCheckout,
  getPendingCheckout,
  trackPurchase,
  trackViewContent,
} from "@/lib/marketing-client";

type OrderStatusResponse =
  | {
      status: "PENDING";
    }
  | {
      amount: number;
      createdAt: string;
      currency: string;
      orderRef: string | null;
      pricingTier: string;
      status: "SUCCESS" | "FAILED";
    };

function formatTier(tier: string | null | undefined) {
  switch (tier) {
    case "ONE_MONTH":
    case "1-month":
      return "Monthly Plan";
    case "SIX_MONTHS":
    case "6-months":
      return "Biannual Plan";
    case "LIFETIME":
    case "lifetime":
      return "Lifetime Access";
    case "FREE_TRIAL":
    case "free-trial":
      return "Free Trial";
    case "TEN_DAYS":
    case "10-days":
      return "10-Day Plan";
    case "ONE_YEAR":
    case "1-year":
      return "Yearly Plan";
    default:
      return "Your plan";
  }
}

// Paygate confirms within seconds when a payment goes through. Polling for
// longer than this only keeps a dead page busy: the buyer closed the payment
// window, or never opened it.
const GIVE_UP_AFTER_MS = 4 * 60 * 1000;

export default function ThankYouClient() {
  const searchParams = useSearchParams();
  const orderRef = searchParams?.get("orderRef") || "";
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "failed" | "unpaid">(
    orderRef ? "pending" : "failed",
  );
  // Whichever robot/plan the buyer was on, so "try again" returns to it even
  // when the payment window came back in a fresh tab (storage is per session).
  const [trial, setTrial] = useState<{ robotSlug: string; robotName: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const pendingCheckout = useMemo(
    () => (orderRef ? getPendingCheckout(orderRef) : null),
    [orderRef],
  );

  useEffect(() => {
    if (!orderRef) {
      setErrorMessage("Missing order reference. Start again from the checkout page.");
      setIsChecking(false);
      return;
    }

    trackViewContent({
      contentName: pendingCheckout?.tier || "GoldBot Checkout",
      contentType: "checkout_status",
      currency: pendingCheckout?.currency,
      value: pendingCheckout?.amount,
    });

    let isActive = true;

    let intervalId = 0;
    const startedAt = Date.now();

    async function checkOrderStatus() {
      try {
        const response = await fetch(
          `/api/paygate/order-status?orderRef=${encodeURIComponent(orderRef)}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error("Unable to verify payment status right now.");
        }

        const data = (await response.json()) as OrderStatusResponse;

        if (!isActive) {
          return;
        }

        if (data.status === "SUCCESS") {
          const purchase = {
            amount: data.amount ?? pendingCheckout?.amount ?? 0,
            currency: data.currency ?? pendingCheckout?.currency ?? "USD",
            orderRef,
            tier: formatTier(data.pricingTier ?? pendingCheckout?.tier),
          };

          trackPurchase(purchase);
          clearPendingCheckout(orderRef);
          setStatus("success");
          setIsChecking(false);
          setErrorMessage(null);
          window.clearInterval(intervalId);
          return;
        }

        if (data.status === "FAILED") {
          // The heading and copy below already explain this; a red error line
          // on top of them reads like something broke on our side.
          setStatus("failed");
          setIsChecking(false);
          window.clearInterval(intervalId);
          return;
        }

        if (Date.now() - startedAt > GIVE_UP_AFTER_MS) {
          setStatus("unpaid");
          setIsChecking(false);
          window.clearInterval(intervalId);
          return;
        }

        setStatus("pending");
        setIsChecking(false);
      } catch (error) {
        if (!isActive) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "Unable to verify payment status right now.";
        setErrorMessage(message);
        setIsChecking(false);
      }
    }

    void checkOrderStatus();
    intervalId = window.setInterval(() => {
      void checkOrderStatus();
    }, 5000);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [orderRef, pendingCheckout]);

  // Only offer the trial when there really is one to claim.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/checkout/free-trial/availability")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.offered || !data?.available || !data?.robotSlug) return;
        setTrial({ robotSlug: data.robotSlug, robotName: data.robotName ?? "a robot" });
      })
      .catch(() => {
        /* no trial button, nothing else changes */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const checkoutUrl = pendingCheckout?.checkoutUrl;
  const planName = formatTier(pendingCheckout?.tier);
  const retryHref = pendingCheckout?.robotSlug
    ? `/checkout?robot=${encodeURIComponent(pendingCheckout.robotSlug)}&tier=${encodeURIComponent(pendingCheckout.tier)}`
    : "/catalog";
  const paid = status === "success";

  return (
    <main
      className="main-content"
      style={{ maxWidth: "760px", margin: "0 auto", padding: "6rem 2rem" }}
    >
      <div className="glass-panel" style={{ textAlign: "center" }}>
        <p
          style={{
            color: "var(--accent-primary)",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            fontSize: "0.8rem",
            marginBottom: "1rem",
          }}
        >
          Checkout status
        </p>
        <h1 style={{ fontSize: "3rem", marginBottom: "1rem" }}>
          {paid
            ? "Payment confirmed"
            : status === "pending"
              ? "Finish your secure checkout"
              : "No payment received"}
        </h1>
        <p style={{ color: "var(--text-secondary)", lineHeight: "1.7", marginBottom: "2rem" }}>
          {paid
            ? "Your payment has been confirmed and your licence is active. Sign in with the link in your email, add your MT5 account number, and your build is compiled within minutes."
            : status === "pending"
              ? "Nothing has been charged yet. Complete the payment in the Paygate window — this page updates on its own as soon as the payment lands."
              : "Nothing was charged for this checkout. The payment window was closed or never completed, so no licence was created and no email was sent. You can try again, or start with the free trial."}
        </p>

        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            borderRadius: "1rem",
            padding: "1.25rem",
            marginBottom: "2rem",
            textAlign: "left",
          }}
        >
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>
            <strong>Reference:</strong> {orderRef || "Unavailable"}
          </p>
          {pendingCheckout?.robotName ? (
            <p style={{ margin: "0.5rem 0 0", color: "var(--text-secondary)" }}>
              <strong>Robot:</strong> {pendingCheckout.robotName}
            </p>
          ) : null}
          {pendingCheckout?.tier ? (
            <p style={{ margin: "0.5rem 0 0", color: "var(--text-secondary)" }}>
              <strong>Plan:</strong> {planName}
            </p>
          ) : null}
          {pendingCheckout?.amount ? (
            <p style={{ margin: "0.5rem 0 0", color: "var(--text-secondary)" }}>
              <strong>Amount:</strong> {pendingCheckout.currency} {pendingCheckout.amount}
            </p>
          ) : null}
        </div>

        {!paid ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {checkoutUrl ? (
              <button
                type="button"
                className="btn-primary"
                style={{ border: "none", alignSelf: "center" }}
                onClick={() => window.open(checkoutUrl, "al-ai-fx-paygate", "noopener,noreferrer")}
              >
                Open secure checkout
              </button>
            ) : (
              // The payment window can return in a fresh tab, and the saved
              // link lives in that tab's session storage — so send them back to
              // checkout rather than showing a dead button.
              <Link href={retryHref} className="btn-primary" style={{ alignSelf: "center" }}>
                Back to checkout
              </Link>
            )}

            {trial ? (
              <Link
                href={`/checkout?robot=${encodeURIComponent(trial.robotSlug)}&tier=free-trial`}
                className="btn-secondary"
                style={{ alignSelf: "center" }}
              >
                Start the free trial instead
              </Link>
            ) : null}

            <p style={{ color: "var(--text-secondary)", margin: 0 }}>
              {status === "pending"
                ? isChecking
                  ? "Checking for payment confirmation..."
                  : "This page checks again every few seconds."
                : "This reference only identifies the checkout attempt — it is not a receipt."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <Link href="/" className="btn-primary" style={{ alignSelf: "center" }}>
              Back to home
            </Link>
            <Link href="/support" className="btn-secondary" style={{ alignSelf: "center" }}>
              Contact support
            </Link>
          </div>
        )}

        {errorMessage ? (
          <p style={{ marginTop: "1.5rem", color: "#fca5a5" }}>{errorMessage}</p>
        ) : null}
      </div>
    </main>
  );
}
