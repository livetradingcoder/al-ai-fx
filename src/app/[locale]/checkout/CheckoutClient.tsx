"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  KeyRound,
  LoaderCircle,
  Lock,
  Mail,
  ShieldCheck,
  Tag,
  Zap,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import {
  storePendingCheckout,
  trackBeginCheckout,
  trackViewContent,
} from "@/lib/marketing-client";
import { buildCheckoutThankYouPath } from "@/lib/marketing";
import { TierId, PRICING_TIERS, RETIRED_ROBOTS } from "@/config/pricing";
import "./checkout.css";

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

function CheckoutContent({ referralDiscount }: { referralDiscount: number }) {
  const t = useTranslations("Checkout");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const urlTier = (searchParams?.get("tier") || "1-month") as TierId;
  const urlRobot = searchParams?.get("robot") || "";
  const robotNameParam = searchParams?.get("name") || "your robot";

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Coupon state. The preview here is cosmetic — create-session re-validates
  // and re-prices, so nothing typed in this box can change what is charged.
  const [couponCode, setCouponCode] = useState("");
  const [couponChecking, setCouponChecking] = useState(false);
  const [coupon, setCoupon] = useState<{
    code: string;
    label: string;
    priceAfter: number;
    free: boolean;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [showCoupon, setShowCoupon] = useState(false);

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
          const successor = purchasable.find((r) => r.slug === RETIRED_ROBOTS[urlRobot]);
          setSelectedSlug(successor?.slug ?? purchasable[0]?.slug ?? "");
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

  // Reflect the picker in the address bar: the URL a buyer copies (or lands on
  // after Back) should be the robot and plan they are actually looking at.
  useEffect(() => {
    if (!selectedSlug) return;
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    if (next.get("robot") === selectedSlug && next.get("tier") === tier) return;
    next.set("robot", selectedSlug);
    next.set("tier", tier);
    if (robot?.name) next.set("name", robot.name);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [selectedSlug, tier, robot?.name, pathname, router, searchParams]);

  // Mirrors the server rule in create-session: a coupon and the referral
  // discount never stack — whichever is cheaper for the buyer wins.
  const referralPrice =
    referralDiscount > 0 && !isFreeTrial
      ? Math.round(displayAmount * (100 - referralDiscount)) / 100
      : null;
  const payable = coupon
    ? Math.min(coupon.priceAfter, referralPrice ?? displayAmount)
    : referralPrice ?? displayAmount;
  const discounted = payable < displayAmount;

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
      robotName: robot?.name ?? robotNameParam,
      robotSlug: selectedSlug,
      tier: input.tier,
    });

    trackBeginCheckout({
      amount: input.amount,
      currency: input.currency,
      orderRef: input.orderRef,
      robotName: robot?.name ?? robotNameParam ?? undefined,
      robotSlug: selectedSlug,
      tier: input.tier,
    });

    window.location.assign(buildCheckoutThankYouPath(locale, input.orderRef));
  }

  // Re-checking on every robot/plan change would fight the user's typing, so
  // a scope change just clears the applied code and they re-apply.
  useEffect(() => {
    setCoupon(null);
    setCouponError(null);
  }, [selectedSlug, tier]);

  async function applyCoupon() {
    const code = couponCode.trim();
    if (!code) return;
    setCouponChecking(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          robotSlug: selectedSlug,
          tier,
          email: email.trim().toLowerCase() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setCoupon(null);
        setCouponError(data.reason || data.error || "That code is not valid.");
        return;
      }
      setCoupon({
        code: data.code,
        label: data.label,
        priceAfter: data.priceAfter,
        free: data.free,
      });
    } catch {
      setCouponError("Could not check that code. Try again.");
    } finally {
      setCouponChecking(false);
    }
  }

  // Card payments go through Polar, crypto through OxaPay. Both endpoints
  // answer the same shape, so the thank-you flow is shared.
  async function handleCheckout(provider: "polar" | "oxapay") {
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

      const response = await fetch(
        provider === "polar" ? "/api/checkout/polar" : "/api/checkout/oxapay",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tier,
            email: email.trim().toLowerCase(),
            currency: "USD",
            robotSlug: selectedSlug,
            couponCode: coupon?.code ?? couponCode.trim() ?? "",
            locale,
          }),
        },
      );

      const data = (await response.json()) as {
        amount?: number | string;
        checkoutUrl?: string;
        currency?: string;
        error?: string;
        orderRef?: string;
        freeCheckout?: boolean;
      };

      // A code that covers the whole price provisions immediately — there is no
      // payment page to send anyone to.
      if (response.ok && data.freeCheckout) {
        setIsSubmitting(false);
        setIsSuccess(true);
        return;
      }

      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error || "Unable to initialize checkout.");
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

  const monthlyEquivalent: Partial<Record<TierId, number>> = {
    "6-months": 6,
    "1-year": 12,
  };
  const stepCount = robots && robots.length > 1 ? 3 : 2;

  return (
    <main className="main-content co-shell">
      <div className="co-container">
        <header className="co-header">
          <span className="co-secure-pill">
            <Lock size={13} aria-hidden="true" />
            {t("secureCheckout")}
          </span>
          <h1>
            {isSuccess ? "You're all set." : <>Complete your order<span>.</span></>}
          </h1>
          <p>{t("checkoutSubtitle")}</p>
        </header>

        <div className="co-grid">
          <section className="co-panel" aria-label={t("accPaymentDetails")}>
            {isSuccess ? (
              <motion.div
                className="co-success"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <motion.span
                  className="co-success-icon"
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 18, delay: 0.1 }}
                >
                  <CircleCheck size={40} aria-hidden="true" />
                </motion.span>
                <h2>{t("accountActivated")}</h2>
                <p>
                  Your {robotName} access is active. We sent a secure dashboard
                  sign-in link to <strong>{email}</strong>.
                </p>

                <ol className="co-next-steps">
                  <li>
                    <span>1</span>
                    Check your inbox and spam folder for the sign-in link.
                  </li>
                  <li>
                    <span>2</span>
                    Open your dashboard and enter your MT5 account number.
                  </li>
                  <li>
                    <span>3</span>
                    Your build is compiled to that account within minutes.
                  </li>
                </ol>

                <Link href="/" className="co-submit">
                  Back to home
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </motion.div>
            ) : (
              <form
                className="co-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleCheckout("polar");
                }}
              >
                {robots && robots.length > 1 && (
                  <fieldset className="co-step">
                    <legend>
                      <span className="co-step-num">1</span>
                      Choose your robot
                    </legend>
                    <div className="co-robot-grid">
                      {robots.map((r) => {
                        const active = r.slug === selectedSlug;
                        return (
                          <button
                            key={r.slug}
                            type="button"
                            className={`co-option co-robot ${active ? "is-active" : ""}`}
                            onClick={() => setSelectedSlug(r.slug)}
                            aria-pressed={active}
                          >
                            <span className="co-radio" aria-hidden="true" />
                            <span className="co-option-body">
                              <strong>{r.name}</strong>
                              {r.shortDescription && <small>{r.shortDescription}</small>}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                )}

                {robot && availableTiers.length > 0 && (
                  <fieldset className="co-step">
                    <legend>
                      <span className="co-step-num">{stepCount === 3 ? 2 : 1}</span>
                      Choose your plan
                    </legend>
                    <div className="co-plan-list">
                      {availableTiers.map((id) => {
                        const active = id === tier;
                        const months = monthlyEquivalent[id];
                        const price = robot.prices[id];
                        return (
                          <button
                            key={id}
                            type="button"
                            className={`co-option co-plan ${active ? "is-active" : ""}`}
                            onClick={() => setTier(id)}
                            aria-pressed={active}
                          >
                            <span className="co-radio" aria-hidden="true" />
                            <span className="co-option-body">
                              <strong>
                                {planDetails[id]?.name ?? id}
                                {id === "1-year" && <em className="co-tag">Best value</em>}
                              </strong>
                              {months && price > 0 && (
                                <small>{formatUsd(Math.round(price / months))} / month</small>
                              )}
                            </span>
                            <span className="co-plan-price">{formatUsd(price)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                )}

                <fieldset className="co-step">
                  <legend>
                    <span className="co-step-num">
                      {robot && availableTiers.length > 0 ? stepCount : 1}
                    </span>
                    Your details
                  </legend>

                  <label className="co-field">
                    <span className="co-label">{t("emailAddress")}</span>
                    <span className="co-input-wrap">
                      <Mail size={16} aria-hidden="true" />
                      <input
                        type="email"
                        placeholder="you@domain.com"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                      />
                    </span>
                  </label>

                  <p className="co-hint">
                    <Image src="/brand/metatrader-5.png" alt="" width={16} height={16} />
                    {t("setMt5Later")}
                  </p>

                  {!isFreeTrial && (
                    <div className="co-coupon">
                      {showCoupon || coupon || couponError ? (
                        <>
                          <span className="co-label">
                            Coupon code <em>(optional)</em>
                          </span>
                          <div className="co-coupon-row">
                            <span className="co-input-wrap">
                              <Tag size={16} aria-hidden="true" />
                              <input
                                type="text"
                                placeholder="Enter code"
                                value={couponCode}
                                onChange={(event) => {
                                  setCouponCode(event.target.value.toUpperCase());
                                  setCoupon(null);
                                  setCouponError(null);
                                }}
                                className="co-coupon-input"
                              />
                            </span>
                            <button
                              type="button"
                              className="co-apply"
                              onClick={() => void applyCoupon()}
                              disabled={couponChecking || !couponCode.trim()}
                            >
                              {couponChecking ? "Checking…" : "Apply"}
                            </button>
                          </div>
                          {coupon && (
                            <p className="co-msg is-success">
                              <CircleCheck size={15} aria-hidden="true" />
                              {coupon.code} applied — {coupon.label}.{" "}
                              {coupon.free
                                ? "No payment needed; your licence is created straight away."
                                : `You pay ${formatUsd(coupon.priceAfter)}.`}
                            </p>
                          )}
                          {couponError && (
                            <p className="co-msg is-error">
                              <CircleAlert size={15} aria-hidden="true" />
                              {couponError}
                            </p>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          className="co-link-button"
                          onClick={() => setShowCoupon(true)}
                        >
                          <Tag size={14} aria-hidden="true" />
                          Have a coupon code?
                        </button>
                      )}
                    </div>
                  )}
                </fieldset>

                <div className="co-pay">
                  {checkoutError && (
                    <p className="co-msg is-error co-pay-error" role="alert">
                      <CircleAlert size={15} aria-hidden="true" />
                      {checkoutError}
                    </p>
                  )}

                  <button type="submit" className="co-submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <LoaderCircle size={18} className="co-spin" aria-hidden="true" />
                    ) : (
                      <Lock size={16} aria-hidden="true" />
                    )}
                    {isFreeTrial
                      ? t("startFreeTrial")
                      : isSubmitting
                        ? t("redirecting")
                        : `${t("payByCard")} · ${formatUsd(payable)}`}
                  </button>

                  {!isFreeTrial && (
                    <button
                      type="button"
                      className="co-submit co-submit-alt"
                      disabled={isSubmitting}
                      onClick={() => void handleCheckout("oxapay")}
                    >
                      {`${t("payWithCrypto")} · ${formatUsd(payable)}`}
                    </button>
                  )}

                  <p className="co-pay-note">
                    {isFreeTrial ? t("freeTrialAction") : t("checkoutRedirect")}
                  </p>

                  <div className="co-pay-meta">
                    <span>
                      <ShieldCheck size={14} aria-hidden="true" />
                      Card by Polar · Crypto by OxaPay
                    </span>
                    {!isFreeTrial && (
                      <span>
                        USD · {selectedPlan.amount}
                      </span>
                    )}
                  </div>
                </div>
              </form>
            )}
          </section>

          <aside className="co-summary" aria-label={t("orderSummary")}>
            <div className="co-summary-card">
              <div className="co-summary-art">
                {/* Admin-entered artwork can live on any host, which next/image
                    would reject without remotePatterns — same as the catalog. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={robot?.artworkUrl || "/brand/hero-robot-gold.png"}
                  alt=""
                  className="co-summary-img"
                />
                <span className="co-summary-mt5">
                  <Image src="/brand/metatrader-5.png" alt="" width={14} height={14} />
                  MT5
                </span>
              </div>

              <div className="co-summary-body">
                <span className="co-summary-eyebrow">{t("orderSummary")}</span>
                <h2>{robotName}</h2>

                <dl className="co-lines">
                  <div>
                    <dt>{t("plan")}</dt>
                    <dd>{selectedPlan.name}</dd>
                  </div>
                  <div>
                    <dt>{t("product")}</dt>
                    <dd>{robotName}</dd>
                  </div>
                  <div>
                    <dt>Subtotal</dt>
                    <dd className="co-num">{selectedPlan.price}</dd>
                  </div>
                  {discounted && (
                    <div className="is-discount">
                      <dt>Discount</dt>
                      <dd className="co-num">−{formatUsd(displayAmount - payable)}</dd>
                    </div>
                  )}
                </dl>

                <div className="co-total">
                  <span>{t("total")}</span>
                  <strong className="co-num">{formatUsd(payable)}</strong>
                </div>

                {referralPrice !== null && !coupon && (
                  <p className="co-msg is-success">
                    <CircleCheck size={15} aria-hidden="true" />
                    Referral discount applied — {referralDiscount}% off your first licence.
                  </p>
                )}

                <p className="co-renew">{t("autoRenews")}</p>

                <ul className="co-trust">
                  <li>
                    <KeyRound size={15} aria-hidden="true" />
                    Build locked to your MT5 account
                  </li>
                  <li>
                    <Zap size={15} aria-hidden="true" />
                    Delivered automatically after checkout
                  </li>
                  <li>
                    <ShieldCheck size={15} aria-hidden="true" />
                    Payment handled securely by Paygate
                  </li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function CheckoutClient({ referralDiscount = 0 }: { referralDiscount?: number }) {
  const t = useTranslations("Checkout");

  return (
    <Suspense
      fallback={
        <div className="co-loading">
          <LoaderCircle size={20} className="co-spin" aria-hidden="true" />
          <p>{t("loadingCheckout")}</p>
        </div>
      }
    >
      <CheckoutContent referralDiscount={referralDiscount} />
    </Suspense>
  );
}
