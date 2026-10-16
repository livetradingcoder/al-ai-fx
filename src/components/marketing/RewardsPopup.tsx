"use client";

import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { Link, usePathname } from "@/i18n/routing";
import { formatDate } from "@/lib/format-date";
import { rewardCheckoutPath } from "@/lib/reward-links";
import type { RewardsOffer } from "@/lib/rewards-offer";
import ProofPortal from "./ProofPortal";
import { useModal } from "./useModal";
import "./rewards.css";

// The reward pop-up for people on a free trial. A small launcher shows their
// progress ("Earn 25% off", 1 of 3 done); opening it shows the three missions
// (link MT5, send results, share them) and the reward. When a code is earned it
// opens once by itself to hand it over. Storage is wrapped throughout: with it
// blocked the pop-up still works, it just may show the unlock card again.

const HIDDEN_PATHS = ["/dashboard", "/checkout", "/login", "/forgot-password", "/magic-login", "/results/submit", "/giveaway"];
const LAUNCHER_KEY = "gb_rewards_launcher_hidden_v1";
const SEEN_KEY = "gb_reward_seen_v1";
const LAUNCHER_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage blocked */
  }
}

// ---------------------------------------------------------------------------
// Presentational pieces. Exported so they can be looked at with sample data.
// ---------------------------------------------------------------------------

function Ring({ percent }: { percent: number }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  return (
    <svg className="rw-ring" viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(24,26,32,0.25)" strokeWidth="4" />
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        stroke="#181a20"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - percent / 100)}
        transform="rotate(-90 18 18)"
      />
    </svg>
  );
}

export function RewardsLauncher({
  offer,
  onOpen,
  onHide,
}: {
  offer: RewardsOffer;
  onOpen: () => void;
  onHide: () => void;
}) {
  const unlocked = !!offer.snapshot.share?.coupon;
  return (
    <div className="rw-scope rw-launcher">
      <button type="button" className="rw-launcher-main" onClick={onOpen} aria-haspopup="dialog">
        <Ring percent={offer.progress.percent} />
        <span>
          {unlocked ? `${offer.snapshot.rewardPercent}% off unlocked` : `Earn ${offer.snapshot.rewardPercent}% off`}
          <small>
            {unlocked ? "Tap to see your code" : `${offer.progress.done} of ${offer.progress.total} done`}
          </small>
        </span>
      </button>
      <button type="button" className="rw-launcher-x" onClick={onHide} aria-label="Hide for now">
        ×
      </button>
    </div>
  );
}

function Mission({
  state,
  title,
  reward,
}: {
  state: "done" | "active" | "locked";
  title: string;
  reward: string;
}) {
  return (
    <li className="rw-mission" data-state={state}>
      <span className="rw-mission-mark" aria-hidden="true">
        {state === "done" ? "✓" : state === "active" ? "●" : "○"}
      </span>
      <span className="rw-mission-title">{title}</span>
      <span className="rw-mission-reward">{reward}</span>
    </li>
  );
}

export function RewardsDialog({
  offer,
  locale,
  unlocked,
  onClose,
}: {
  offer: RewardsOffer;
  locale: string;
  unlocked: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useModal(true, onClose, ref);
  const [copied, setCopied] = useState(false);

  const { snapshot, progress } = offer;
  const coupon = snapshot.share?.coupon ?? null;
  const hasProof = snapshot.proofs.some((p) => p.status !== "REJECTED");
  const sharing = !!snapshot.share && snapshot.share.status !== "REJECTED";

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the code is on screen to copy by hand */
    }
  }

  return (
    <div
      className="rw-scope rw-popup-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`rw-popup rw-popup--wide${coupon ? " rw-popup--won" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rw-rewards-title"
      >
        <button type="button" className="rw-popup-close" aria-label="Close" onClick={onClose}>
          ×
        </button>

        {coupon ? (
          <>
            <span className="rw-eyebrow">{unlocked ? "Reward unlocked" : "Your reward"}</span>
            <h2 id="rw-rewards-title">
              You earned {snapshot.rewardPercent}% off
            </h2>
            <p className="rw-muted" style={{ marginTop: "8px" }}>
              Thanks for sharing your results. Your one-time code works on this email address only
              {coupon.expiresAt ? `, until ${formatDate(coupon.expiresAt)}` : ""}.
            </p>
            <div className="rw-row" style={{ margin: "18px 0" }}>
              <span className="rw-code rw-code--glow">{coupon.code}</span>
              <button type="button" className="rw-btn rw-btn--ghost rw-btn--small" onClick={() => void copy(coupon.code)}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="rw-row">
              <Link
                className="rw-btn"
                href={rewardCheckoutPath(coupon.code)}
                onClick={onClose}
              >
                Use my code
              </Link>
              {snapshot.giveaway && (
                <span className="rw-small">
                  You also have {snapshot.giveaway.chances} {snapshot.giveaway.chances === 1 ? "chance" : "chances"} in
                  the {snapshot.giveaway.title}.
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <span className="rw-eyebrow">Rewards</span>
            <h2 id="rw-rewards-title">Earn {snapshot.rewardPercent}% off GoldBot</h2>
            <p className="rw-muted" style={{ marginTop: "8px" }}>
              Show how your trial went and share it. We check every post, then send you a one-time code.
            </p>

            <div className="rw-progress" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} style={{ margin: "16px 0 12px" }}>
              <span style={{ width: `${progress.percent}%` }} />
            </div>

            <ul className="rw-missions">
              <Mission state={snapshot.linked ? "done" : "active"} title="Link your MT5 account" reward="GoldBot starts" />
              <Mission
                state={hasProof ? "done" : snapshot.linked ? "active" : "locked"}
                title="Send your results"
                reward="+1 giveaway chance"
              />
              <Mission
                state={sharing ? "done" : hasProof ? "active" : "locked"}
                title="Share it on social media"
                reward={`${snapshot.rewardPercent}% off + 1 chance`}
              />
            </ul>

            <div style={{ marginTop: "18px" }}>
              <ProofPortal token={offer.token} locale={locale} initial={snapshot} compact />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The mounted widget
// ---------------------------------------------------------------------------

export default function RewardsPopup() {
  const { status } = useSession();
  const locale = useLocale();
  const pathname = usePathname();
  const [offer, setOffer] = useState<RewardsOffer | null>(null);
  const [open, setOpen] = useState(false);
  const [unlockedOpen, setUnlockedOpen] = useState(false);
  // Read once, on the client. The component renders nothing until an offer has
  // loaded, so this never shows in the server HTML and cannot mismatch it.
  const [launcherHidden, setLauncherHidden] = useState(() =>
    typeof window === "undefined" ? true : (Number(read(LAUNCHER_KEY)) || 0) > Date.now(),
  );
  const autoOpened = useRef(false);

  const hiddenHere = HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const suppressed = status !== "authenticated" || hiddenHere;

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/rewards/summary?locale=${encodeURIComponent(locale)}`, { cache: "no-store" });
      const data = (await res.json()) as { offer: RewardsOffer | null };
      const next = res.ok ? data.offer : null;
      setOffer(next);

      // A code that has just been earned opens by itself, once.
      const code = next?.snapshot.share?.coupon?.code;
      if (code && !autoOpened.current && read(SEEN_KEY) !== code) {
        autoOpened.current = true;
        setUnlockedOpen(true);
        setOpen(true);
      }
    } catch {
      setOffer(null);
    }
  }, [locale]);

  useEffect(() => {
    if (suppressed) return;
    const timer = setTimeout(() => void load(), 2000);
    return () => clearTimeout(timer);
  }, [suppressed, load, pathname]);

  const close = useCallback(() => {
    const code = offer?.snapshot.share?.coupon?.code;
    if (code) write(SEEN_KEY, code);
    setOpen(false);
    setUnlockedOpen(false);
    void load(); // pick up anything done inside the pop-up
  }, [offer, load]);

  if (suppressed || !offer) return null;

  return (
    <>
      {!launcherHidden && !open && (
        <RewardsLauncher
          offer={offer}
          onOpen={() => setOpen(true)}
          onHide={() => {
            write(LAUNCHER_KEY, String(Date.now() + LAUNCHER_SNOOZE_MS));
            setLauncherHidden(true);
          }}
        />
      )}
      {open && <RewardsDialog offer={offer} locale={locale} unlocked={unlockedOpen} onClose={close} />}
    </>
  );
}
