"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export type CalcPlan = { id: string; label: string; price: number };
type Rate = { name: string; rate: number };

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// Mirrors how commission is actually computed: a percentage of the order
// amount, where a referral's FIRST order carries their discount and renewals
// are full price (and only count when the programme pays on renewals).
export default function EarningsCalculator({
  plans,
  rates,
  referredDiscount,
  lifetimeScope,
}: {
  plans: CalcPlan[];
  rates: Rate[];
  referredDiscount: number;
  lifetimeScope: boolean;
}) {
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [rateName, setRateName] = useState(rates[0]?.name ?? "");
  const [referrals, setReferrals] = useState(10);

  const plan = plans.find((p) => p.id === planId) ?? plans[0];
  const rate = rates.find((r) => r.name === rateName) ?? rates[0];
  if (!plan || !rate) return null;

  const firstOrder = plan.price * (1 - referredDiscount / 100);
  const firstTotal = (firstOrder * rate.rate * referrals) / 100;
  const renewalTotal = (plan.price * rate.rate * referrals) / 100;
  const fill = ((referrals - 1) / (100 - 1)) * 100;

  return (
    <div className="af-calc">
      <div className="af-calc-inputs">
        <label className="af-field">
          <span>Plan your referrals buy</span>
          <select value={planId} onChange={(event) => setPlanId(event.target.value)}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} — {usd(p.price)}
              </option>
            ))}
          </select>
        </label>

        <div className="af-field">
          <span>Your commission tier</span>
          <div className="af-segment" role="radiogroup" aria-label="Commission tier">
            {rates.map((r) => (
              <button
                key={r.name}
                type="button"
                role="radio"
                aria-checked={r.name === rate.name}
                className={r.name === rate.name ? "is-active" : ""}
                onClick={() => setRateName(r.name)}
              >
                {r.name}
                <em>{r.rate}%</em>
              </button>
            ))}
          </div>
        </div>

        <label className="af-field">
          <span className="af-field-row">
            Referrals who buy
            <strong>{referrals}</strong>
          </span>
          <input
            type="range"
            min={1}
            max={100}
            value={referrals}
            onChange={(event) => setReferrals(Number(event.target.value))}
            style={{ "--fill": `${fill}%` } as React.CSSProperties}
            aria-valuetext={`${referrals} referrals`}
          />
          <span className="af-range-scale" aria-hidden="true">
            <span>1</span>
            <span>50</span>
            <span>100</span>
          </span>
        </label>
      </div>

      <div className="af-calc-output" aria-live="polite">
        <div className="af-calc-figure">
          <span>From their first orders</span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.strong
              key={`${planId}-${rateName}-${referrals}-first`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {usd(firstTotal)}
            </motion.strong>
          </AnimatePresence>
          <small>
            {rate.rate}% of {usd(firstOrder)} (after their {referredDiscount}% discount) × {referrals}
          </small>
        </div>

        {lifetimeScope && (
          <div className="af-calc-figure is-renewal">
            <span>Then on every renewal</span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.strong
                key={`${planId}-${rateName}-${referrals}-renew`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                {usd(renewalTotal)}
              </motion.strong>
            </AnimatePresence>
            <small>
              {rate.rate}% of {usd(plan.price)} × {referrals}, each time they renew
            </small>
          </div>
        )}

        <p className="af-calc-note">
          An illustration, not a promise: it assumes every referral buys this plan
          {lifetimeScope ? " and renews" : ""}. Real earnings depend on what your audience buys.
        </p>
      </div>
    </div>
  );
}
