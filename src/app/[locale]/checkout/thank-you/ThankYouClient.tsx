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
    default:
      return "GoldBot Plan";
  }
}

export default function ThankYouClient() {
  const searchParams = useSearchParams();
  const orderRef = searchParams?.get("orderRef") || "";
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "failed">(
    orderRef ? "pending" : "failed",
  );
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
          setStatus("failed");
          setIsChecking(false);
          setErrorMessage("The payment did not complete. You can reopen checkout and try again.");
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

  const checkoutUrl = pendingCheckout?.checkoutUrl;
  const planName = formatTier(pendingCheckout?.tier);

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
          GoldBot checkout status
        </p>
        <h1 style={{ fontSize: "3rem", marginBottom: "1rem" }}>
          {status === "success" ? "Payment confirmed" : "Finish your secure checkout"}
        </h1>
        <p style={{ color: "var(--text-secondary)", lineHeight: "1.7", marginBottom: "2rem" }}>
          {status === "success"
            ? "Your payment has been confirmed and your GoldBot order is now active. Your welcome email and access details should be in your inbox."
            : "We are waiting for Paygate to confirm your payment. Keep this tab open while you complete the secure payment window."}
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
            <strong>Order reference:</strong> {orderRef || "Unavailable"}
          </p>
          <p style={{ margin: "0.5rem 0 0", color: "var(--text-secondary)" }}>
            <strong>Plan:</strong> {planName}
          </p>
          {pendingCheckout?.amount ? (
            <p style={{ margin: "0.5rem 0 0", color: "var(--text-secondary)" }}>
              <strong>Amount:</strong> {pendingCheckout.currency} {pendingCheckout.amount}
            </p>
          ) : null}
        </div>

        {status !== "success" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <button
              type="button"
              className="btn-primary"
              style={{ border: "none", alignSelf: "center" }}
              onClick={() => {
                if (checkoutUrl) {
                  window.open(checkoutUrl, "_blank", "noopener,noreferrer");
                }
              }}
              disabled={!checkoutUrl}
            >
              {checkoutUrl ? "Open secure checkout" : "Checkout link unavailable"}
            </button>
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>
              {isChecking
                ? "Checking for payment confirmation..."
                : "We will refresh this status automatically every few seconds."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <Link href="/login" className="btn-primary" style={{ alignSelf: "center" }}>
              Go to login
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
