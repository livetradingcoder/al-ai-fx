"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowRight, Check, Crown } from "lucide-react";

import {
  fillTemplate,
  formatUsd,
  type CatalogPlan,
  type CatalogRobot,
  type CatalogTrial,
} from "@/lib/pricing-catalog";
import {
  PLAN_FEATURES,
  PLAN_NOTE_KEY,
  PLAN_PERIOD_KEY,
  PLAN_TITLE_KEY,
  TRIAL_FEATURES,
  type PricingLabelKey,
  type PricingLabels,
} from "./labels";
import "./pricing.css";

// Where a free trial stands for this visitor: the per-connection cooldown and the
// monthly cap are about the visitor, not the robot, so one answer serves every tab.
type FreeTrialStatus = {
  available: boolean;
  message?: string;
  resetsAt?: string | null;
  remaining?: number;
  cap?: number;
};

const checkoutHref = (tier: string, robot: CatalogRobot) =>
  `/checkout?tier=${tier}&robot=${robot.slug}&name=${encodeURIComponent(robot.name)}`;

function Features({ keys, labels }: { keys: PricingLabelKey[]; labels: PricingLabels }) {
  return (
    <ul className="px-features">
      {keys.map((key) => (
        <li key={key}>
          <span className="px-check" aria-hidden="true">
            <Check size={12} strokeWidth={3} />
          </span>
          {labels[key]}
        </li>
      ))}
    </ul>
  );
}

function TrialCard({
  robot,
  trial,
  labels,
  status,
}: {
  robot: CatalogRobot;
  trial: CatalogTrial;
  labels: PricingLabels;
  status: FreeTrialStatus | null;
}) {
  const days = trial.days;
  const blocked = trial.free && status !== null && !status.available;
  const title = fillTemplate(trial.free ? labels.pricingFreeTrialTitle : labels.pricingTrialTitle, { days });

  return (
    <article className="px-card px-card-trial">
      <header className="px-card-head">
        <h4>{title}</h4>
      </header>
      <p className="px-note">{trial.free ? labels.pricingFreeTrialNote : labels.pricingTrialNote}</p>

      <p className="px-price">
        <strong>{trial.free ? labels.pricingFree : formatUsd(trial.amount)}</strong>
        <span>{fillTemplate(labels.pricingTrialPeriod, { days })}</span>
      </p>
      {/* The same two lines every plan card has, so the buttons line up across the row. */}
      <p className="px-perday">
        {trial.free ? "" : fillTemplate(labels.pricingPerDay, { price: formatUsd(Math.round((trial.amount / days) * 100) / 100) })}
      </p>
      <p className="px-save" />

      {blocked ? (
        <>
          <span className="px-cta is-disabled" aria-disabled="true">
            {labels.pricingTrialUnavailable}
          </span>
          <p className="px-fine">
            {status.message}
            {status.resetsAt
              ? ` ${fillTemplate(labels.pricingTryAgainAfter, { date: new Date(status.resetsAt).toLocaleDateString() })}`
              : ""}
          </p>
        </>
      ) : (
        <>
          <Link href={checkoutHref("free-trial", robot)} className="px-cta is-outline">
            {trial.free ? labels.pricingFreeTrialCta : fillTemplate(labels.pricingTrialCta, { days })}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <p className="px-fine">
            {trial.free ? labels.pricingFreeTrialFine : labels.pricingTrialFine}
            {trial.free && status?.remaining !== undefined && status.cap
              ? ` ${fillTemplate(labels.pricingTrialsLeft, { left: status.remaining, cap: status.cap })}.`
              : ""}
          </p>
        </>
      )}

      <div className="px-divider" />
      <Features keys={TRIAL_FEATURES} labels={labels} />
    </article>
  );
}

function PlanCard({ robot, plan, labels }: { robot: CatalogRobot; plan: CatalogPlan; labels: PricingLabels }) {
  const noteKey = PLAN_NOTE_KEY[plan.tier];
  // The half-year and year show what a month costs on them; every plan shows its day.
  const note = plan.perMonth !== null ? fillTemplate(labels.calcPerMonth, { price: formatUsd(plan.perMonth) }).replace(/[()]/g, "") : noteKey ? labels[noteKey] : "";

  return (
    <article className={`px-card ${plan.popular ? "is-popular" : ""}`}>
      <header className="px-card-head">
        <h4>{labels[PLAN_TITLE_KEY[plan.tier]]}</h4>
        {plan.popular && <span className="px-badge">{labels.pricingMostPopular}</span>}
      </header>
      <p className="px-note">{note}</p>

      <p className="px-price">
        <strong>{formatUsd(plan.amount)}</strong>
        <span>{labels[PLAN_PERIOD_KEY[plan.tier]]}</span>
      </p>
      <p className="px-perday">{fillTemplate(labels.pricingPerDay, { price: formatUsd(plan.perDay) })}</p>
      <p className="px-save">
        {plan.savingsPercent !== null ? (
          <span>{fillTemplate(labels.pricingSave, { percent: plan.savingsPercent })}</span>
        ) : null}
      </p>

      <Link href={checkoutHref(plan.tier, robot)} className={`px-cta ${plan.popular ? "is-primary" : ""}`}>
        {fillTemplate(labels.pricingGetRobot, { name: robot.name })}
        <ArrowRight size={16} aria-hidden="true" />
      </Link>

      <div className="px-divider" />
      <Features keys={PLAN_FEATURES[plan.tier]} labels={labels} />
    </article>
  );
}

export default function PricingExplorer({
  robots,
  defaultSlug,
  labels,
}: {
  robots: CatalogRobot[];
  defaultSlug: string;
  labels: PricingLabels;
}) {
  const [active, setActive] = useState(defaultSlug);
  const [status, setStatus] = useState<FreeTrialStatus | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Only ask about the free-trial limits when some robot actually gives one away.
  const anyFree = robots.some((r) => r.trial?.free);
  useEffect(() => {
    if (!anyFree) return;
    let cancelled = false;
    fetch("/api/checkout/free-trial/availability")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.available === "boolean") setStatus(data);
      })
      .catch(() => {
        /* the card falls back to its normal link; the server re-checks at claim time */
      });
    return () => {
      cancelled = true;
    };
  }, [anyFree]);

  const select = useCallback((slug: string, focus = false) => {
    setActive(slug);
    const tab = tabRefs.current[slug];
    if (!tab) return;
    if (focus) tab.focus();
    // Keep the chosen tab in view in the scrolling row on a phone, without moving the page.
    tab.scrollIntoView({ block: "nearest", inline: "center", behavior: "auto" });
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = robots.findIndex((r) => r.slug === active);
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % robots.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + robots.length) % robots.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = robots.length - 1;
    else return;
    event.preventDefault();
    select(robots[next].slug, true);
  };

  return (
    <div className="px-explorer">
      <div className="px-tabs-wrap">
        <div
          className="px-tabs"
          role="tablist"
          aria-label={labels.pricingTabsLabel}
          onKeyDown={onKeyDown}
        >
          {robots.map((robot) => {
            const selected = robot.slug === active;
            return (
              <button
                key={robot.slug}
                ref={(node) => {
                  tabRefs.current[robot.slug] = node;
                }}
                type="button"
                role="tab"
                id={`px-tab-${robot.slug}`}
                aria-selected={selected}
                aria-controls={`px-panel-${robot.slug}`}
                tabIndex={selected ? 0 : -1}
                className={`px-tab ${selected ? "is-active" : ""}`}
                onClick={() => select(robot.slug)}
              >
                <span className="px-tab-name">
                  {robot.flagship && <Crown size={13} aria-hidden="true" />}
                  {robot.name}
                </span>
                {robot.ranges !== null && (
                  <span className="px-tab-meta">
                    {fillTemplate(robot.ranges === 1 ? labels.pricingRangeOne : labels.pricingRanges, {
                      count: robot.ranges,
                    })}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Every robot's panel is in the page (the inactive ones are only hidden), so the
          prices are in the HTML a crawler or a no-script visitor gets. */}
      {robots.map((robot) => (
        <div
          key={robot.slug}
          role="tabpanel"
          id={`px-panel-${robot.slug}`}
          aria-labelledby={`px-tab-${robot.slug}`}
          hidden={robot.slug !== active}
          className="px-panel"
        >
          <header className="px-robot">
            <div className="px-robot-copy">
              <div className="px-robot-title">
                <h3>{robot.name}</h3>
                {robot.flagship && (
                  <span className="px-chip is-gold">
                    <Crown size={12} aria-hidden="true" />
                    {labels.pricingFlagship}
                  </span>
                )}
                {robot.badge && <span className="px-chip">{robot.badge}</span>}
                {robot.ranges !== null && (
                  <span className="px-chip">
                    {fillTemplate(robot.ranges === 1 ? labels.pricingRangeOne : labels.pricingRanges, {
                      count: robot.ranges,
                    })}
                  </span>
                )}
              </div>
              <p>{robot.description}</p>
            </div>
            <Link href={`/robots/${robot.slug}`} className="px-robot-link">
              {fillTemplate(labels.pricingViewRobot, { name: robot.name })}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </header>

          <div className={`px-ladder ${robot.trial && robot.plans.length > 0 ? "has-both" : ""}`}>
            {robot.trial && (
              <section className="px-step" aria-label={labels.pricingStepTry}>
                <p className="px-step-label">{labels.pricingStepTry}</p>
                <TrialCard robot={robot} trial={robot.trial} labels={labels} status={status} />
              </section>
            )}
            {robot.plans.length > 0 && (
              <section className="px-step" aria-label={labels.pricingStepRun}>
                <p className="px-step-label">
                  {labels.pricingStepRun}
                  <span>{labels.pricingStepRunHint}</span>
                </p>
                <div className="px-plans" style={{ "--px-cols": robot.plans.length } as CSSProperties}>
                  {robot.plans.map((plan) => (
                    <PlanCard key={plan.tier} robot={robot} plan={plan} labels={labels} />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
