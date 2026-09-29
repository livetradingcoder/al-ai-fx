"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Clock, Crown, LifeBuoy, Sparkles } from "lucide-react";

export type CatalogRobot = {
  slug: string;
  name: string;
  shortDescription: string;
  badge: string | null;
  artwork: string | null;
  fromPrice: number | null;
  monthlyPrice: number | null;
  hasFreeTrial: boolean;
  comingSoon: boolean;
  flagship: boolean;
};

type FilterId = "all" | "multirange" | "breakout" | "trial";

// Families come from the robot names the catalog already uses; anything that
// matches neither still shows under "All".
const FILTERS: { id: FilterId; label: string; match: (r: CatalogRobot) => boolean }[] = [
  { id: "all", label: "All robots", match: () => true },
  { id: "multirange", label: "MultiRange", match: (r) => /multirange/i.test(r.name) },
  { id: "breakout", label: "Breakout", match: (r) => /breakout/i.test(r.name) },
  { id: "trial", label: "Free trial", match: (r) => r.hasFreeTrial },
];

const usd = (amount: number) => `$${amount.toLocaleString("en-US")}`;

export default function CatalogGrid({ robots }: { robots: CatalogRobot[] }) {
  const [filter, setFilter] = useState<FilterId>("all");

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.id, robots.filter(f.match).length])),
    [robots],
  );
  const visible = robots.filter(FILTERS.find((f) => f.id === filter)!.match);

  if (robots.length === 0) {
    return <div className="cat-empty">No robots available yet — check back soon.</div>;
  }

  return (
    <>
      <div className="cat-filters" role="tablist" aria-label="Filter robots">
        {FILTERS.filter((f) => f.id === "all" || counts[f.id] > 0).map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            className={`cat-filter ${filter === f.id ? "is-active" : ""}`}
            onClick={() => setFilter(f.id)}
          >
            {filter === f.id && (
              <motion.span
                layoutId="cat-filter-pill"
                className="cat-filter-pill"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="cat-filter-label">
              {f.label}
              <em>{counts[f.id]}</em>
            </span>
          </button>
        ))}
      </div>

      <motion.div layout className="cat-grid">
        <AnimatePresence mode="popLayout">
          {visible.map((robot, index) => (
            <motion.article
              key={robot.slug}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.4, delay: Math.min(index, 6) * 0.04, ease: [0.22, 1, 0.36, 1] }}
              className={`cat-card ${robot.flagship ? "is-flagship" : ""} ${robot.comingSoon ? "is-soon" : ""}`}
            >
              <div className="cat-art">
                {robot.artwork ? (
                  // Admin-entered artwork can live on any host (see checkout).
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={robot.artwork} alt="" loading="lazy" />
                ) : (
                  <div className="cat-art-fallback" aria-hidden="true">
                    <span>{robot.name.replace(/[^A-Z0-9]/g, "").slice(0, 3) || "EA"}</span>
                  </div>
                )}
                <div className="cat-tags">
                  {robot.flagship && (
                    <span className="cat-tag is-flagship">
                      <Crown size={12} aria-hidden="true" />
                      Flagship
                    </span>
                  )}
                  {robot.hasFreeTrial && (
                    <span className="cat-tag is-trial">
                      <Sparkles size={12} aria-hidden="true" />
                      Free trial
                    </span>
                  )}
                  {robot.comingSoon && (
                    <span className="cat-tag is-soon">
                      <Clock size={12} aria-hidden="true" />
                      Coming soon
                    </span>
                  )}
                </div>
              </div>

              <div className="cat-body">
                <h2>{robot.name}</h2>
                {robot.badge && <span className="cat-badge">{robot.badge}</span>}
                <p>{robot.shortDescription}</p>

                <div className="cat-foot">
                  {robot.comingSoon ? (
                    <span className="cat-price-soon">Pricing announced at launch</span>
                  ) : (
                    <div className="cat-price">
                      {robot.monthlyPrice !== null ? (
                        <>
                          <strong>{usd(robot.monthlyPrice)}</strong>
                          <span>/ month</span>
                        </>
                      ) : robot.fromPrice !== null ? (
                        <>
                          <span>From</span>
                          <strong>{usd(robot.fromPrice)}</strong>
                        </>
                      ) : null}
                      {robot.fromPrice !== null &&
                        robot.monthlyPrice !== null &&
                        robot.fromPrice < robot.monthlyPrice && (
                          <small>or {usd(robot.fromPrice)} for 10 days</small>
                        )}
                    </div>
                  )}

                  {robot.comingSoon ? (
                    <span className="cat-cta is-disabled" aria-disabled="true">
                      Coming soon
                    </span>
                  ) : (
                    <Link
                      href={`/robots/${robot.slug}`}
                      className={`cat-cta ${robot.flagship ? "is-primary" : ""}`}
                    >
                      View robot
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
      </motion.div>

      <div className="cat-help">
        <LifeBuoy size={20} aria-hidden="true" />
        <div>
          <strong>Not sure which robot fits your account?</strong>
          <span>
            MultiRange robots trade more sessions a day; Breakout robots trade one.
            Start with the free trial or ask us.
          </span>
        </div>
        <div className="cat-help-actions">
          <Link href="/features">How it works</Link>
          <Link href="/support" className="is-primary">
            Contact support
          </Link>
        </div>
      </div>
    </>
  );
}
