"use client";

import { useCallback, useEffect, useState } from "react";

import { Link } from "@/i18n/routing";

import type { PortalSnapshot } from "@/lib/proof-portal";
import "./rewards.css";
import { formatDate } from "@/lib/format-date";
import { rewardCheckoutPath } from "@/lib/reward-links";

// The three steps a trial user works through: send results, share them, collect
// the reward. Used on the secret-link page (token from the email) and on the
// dashboard (token signed for the signed-in user), so both behave identically.

const STATUS_TONE = { PENDING: "wait", APPROVED: "live", REJECTED: "bad" } as const;
const STATUS_TEXT = { PENDING: "Being checked", APPROVED: "Approved", REJECTED: "Not accepted" } as const;

function caption(percent: number) {
  return (
    `I've been trying GoldBot, an automated gold trading robot for MT5. Here are my results from the free trial. ` +
    `Results vary and past performance doesn't guarantee future results. ` +
    `Disclosure: I get a ${percent}% discount for sharing this. https://www.al-ai-fx.xyz #GoldBot #MT5 #ad`
  );
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function ProofPortal({
  token,
  locale,
  initial,
  compact = false,
}: {
  token: string;
  locale: string;
  initial: PortalSnapshot | null;
  /** Inside the pop-up, where a summary of the steps is already showing: skip the step that is done. */
  compact?: boolean;
}) {
  const [snap, setSnap] = useState<PortalSnapshot | null>(initial);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [consent, setConsent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/proofs/status?token=${encodeURIComponent(token)}&locale=${encodeURIComponent(locale)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not load your progress.");
      setSnap(data.snapshot as PortalSnapshot);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load your progress.");
    }
  }, [token, locale]);

  useEffect(() => {
    if (!initial) void refresh();
  }, [initial, refresh]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.set("token", token);
      body.set("image", file);
      body.set("displayName", displayName);
      body.set("publishConsent", consent ? "true" : "false");
      const res = await fetch("/api/proofs/upload", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Upload failed. Please try again.");
      setFile(null);
      setDisplayName("");
      setConsent(false);
      setFileKey((k) => k + 1); // a fresh file input, so the chosen file name clears
      await refresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function submitShare(e: React.FormEvent) {
    e.preventDefault();
    setSharing(true);
    setShareError(null);
    try {
      const res = await fetch("/api/proofs/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, url: shareUrl, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not send that link.");
      setShareUrl("");
      await refresh();
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Could not send that link.");
    } finally {
      setSharing(false);
    }
  }

  async function doCopy(key: string, text: string) {
    if (await copy(text)) {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    }
  }

  if (!snap) {
    return (
      <div className="rw-scope">
        <p className="rw-muted" role="status">
          {loadError ?? "Loading your progress…"}
        </p>
        {loadError && (
          <button type="button" className="rw-btn rw-btn--ghost rw-btn--small" onClick={() => void refresh()}>
            Try again
          </button>
        )}
      </div>
    );
  }

  const live = snap.proofs.filter((p) => p.status !== "REJECTED");
  const hasProof = live.length > 0;
  const canUploadMore = live.length < snap.maxProofs;
  const share = snap.share;
  const coupon = share?.coupon ?? null;
  const canShare = snap.promoEligible && hasProof && (!share || share.status === "REJECTED");

  const state1 = snap.linked ? "done" : "active";
  const state2 = !snap.linked ? "locked" : hasProof ? "done" : "active";
  const state3 = !snap.promoEligible ? "locked" : !hasProof ? "locked" : coupon ? "done" : "active";

  return (
    <div className="rw-scope">
      <ol className="rw-steps">
        {/* 1 · link */}
        {!(compact && snap.linked) && (
        <li className="rw-step" data-state={state1}>
          <span className="rw-step-num" aria-hidden="true">{snap.linked ? "✓" : "1"}</span>
          <div className="rw-step-body">
            <div className="rw-step-title">
              <h3>Link your MT5 account</h3>
              <span className="rw-pill" data-tone={snap.linked ? "live" : "wait"}>{snap.linked ? "Done" : "To do"}</span>
            </div>
            {snap.linked ? (
              <p className="rw-muted">GoldBot is set up on your account.</p>
            ) : (
              <>
                <p className="rw-muted">
                  Link your MT5 account and load GoldBot first, then come back here to send your results.
                </p>
                <Link className="rw-btn rw-btn--small" href="/dashboard/onboarding">
                  Open the setup guide
                </Link>
              </>
            )}
          </div>
        </li>
        )}

        {/* 2 · results */}
        <li className="rw-step" data-state={state2}>
          <span className="rw-step-num" aria-hidden="true">{state2 === "done" ? "✓" : "2"}</span>
          <div className="rw-step-body">
            <div className="rw-step-title">
              <h3>Send your results</h3>
              <span className="rw-pill" data-tone={hasProof ? "live" : "wait"}>{hasProof ? "Sent" : "To do"}</span>
            </div>
            <p className="rw-muted">
              A screenshot of your MT5 history or equity curve. Good and bad results are equally welcome. Hide your
              account number before you upload. Nothing is shown publicly unless you tick the box below and we approve it.
            </p>

            {snap.proofs.length > 0 && (
              <ul className="rw-list" aria-label="Your screenshots">
                {snap.proofs.map((p) => (
                  <li key={p.id}>
                    <span>Sent {formatDate(p.createdAt)}</span>
                    <span>
                      {p.published && <span className="rw-small">on the results page · </span>}
                      <span className="rw-pill" data-tone={STATUS_TONE[p.status]}>{STATUS_TEXT[p.status]}</span>
                    </span>
                    {p.status === "REJECTED" && p.adminNote && <span className="rw-small">{p.adminNote}</span>}
                  </li>
                ))}
              </ul>
            )}

            {snap.linked && canUploadMore && (
              <form onSubmit={upload} style={{ display: "grid", gap: "12px" }}>
                <label className="rw-field">
                  <span>Screenshot (JPG, PNG or WebP, up to 4 MB)</span>
                  <input
                    key={fileKey}
                    className="rw-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    required
                  />
                </label>
                <label className="rw-field">
                  <span>Name to show with it (optional, first name or a nickname)</span>
                  <input
                    className="rw-input"
                    type="text"
                    maxLength={40}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Amina"
                  />
                </label>
                <label className="rw-check">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  <span>
                    You may show this screenshot publicly on al-ai-fx.xyz. I have hidden my account number.
                  </span>
                </label>
                {uploadError && <p className="rw-error" role="alert">{uploadError}</p>}
                <div className="rw-row">
                  <button type="submit" className="rw-btn" disabled={uploading || !file}>
                    {uploading ? "Uploading…" : "Send my results"}
                  </button>
                </div>
                <p className="rw-small">
                  Results differ from one account to the next and past results are no guide to future ones.
                </p>
              </form>
            )}
            {snap.linked && !canUploadMore && (
              <p className="rw-small">You have sent the maximum of {snap.maxProofs} screenshots. Thank you!</p>
            )}
          </div>
        </li>

        {/* 3 · share */}
        <li className="rw-step" data-state={state3}>
          <span className="rw-step-num" aria-hidden="true">{state3 === "done" ? "✓" : "3"}</span>
          <div className="rw-step-body">
            <div className="rw-step-title">
              <h3>Share it, get {snap.rewardPercent}% off</h3>
              {share && <span className="rw-pill" data-tone={STATUS_TONE[share.status]}>{STATUS_TEXT[share.status]}</span>}
            </div>

            {!snap.promoEligible ? (
              <p className="rw-muted">This reward is not available in your region.</p>
            ) : coupon ? (
              <>
                <p className="rw-muted">
                  Thank you for sharing. Here is your one-time code. It works on this email address only
                  {coupon.expiresAt ? ` until ${formatDate(coupon.expiresAt)}` : ""}.
                </p>
                <div className="rw-row">
                  <span className="rw-code">{coupon.code}</span>
                  <button type="button" className="rw-btn rw-btn--ghost rw-btn--small" onClick={() => doCopy("code", coupon.code)}>
                    {copied === "code" ? "Copied" : "Copy"}
                  </button>
                  <Link className="rw-btn rw-btn--small" href={rewardCheckoutPath(coupon.code)}>
                    Use my code
                  </Link>
                </div>
              </>
            ) : share && share.status === "PENDING" ? (
              <p className="rw-muted">
                We got your post and will check it shortly. Your code appears here and is emailed to you once it is approved.
              </p>
            ) : (
              <>
                <p className="rw-muted">
                  Post your results on X, Instagram, Facebook, TikTok, YouTube, LinkedIn or Threads, then paste the link
                  to your post below. Once we have checked it, you get a one-time {snap.rewardPercent}% discount code.
                  Your post must say you get a discount for sharing. The caption below already does.
                </p>
                {share?.status === "REJECTED" && (
                  <p className="rw-error">
                    That link was not accepted{share.adminNote ? `: ${share.adminNote}` : "."} You can send a different one.
                  </p>
                )}
                <label className="rw-field">
                  <span>Suggested caption</span>
                  <textarea className="rw-input" readOnly value={caption(snap.rewardPercent)} />
                </label>
                <div className="rw-row">
                  <button type="button" className="rw-btn rw-btn--ghost rw-btn--small" onClick={() => doCopy("caption", caption(snap.rewardPercent))}>
                    {copied === "caption" ? "Copied" : "Copy caption"}
                  </button>
                </div>
                {canShare ? (
                  <form onSubmit={submitShare} style={{ display: "grid", gap: "12px" }}>
                    <label className="rw-field">
                      <span>Link to your post</span>
                      <input
                        className="rw-input"
                        type="url"
                        inputMode="url"
                        placeholder="https://x.com/yourname/status/…"
                        value={shareUrl}
                        onChange={(e) => setShareUrl(e.target.value)}
                        required
                      />
                    </label>
                    {shareError && <p className="rw-error" role="alert">{shareError}</p>}
                    <div className="rw-row">
                      <button type="submit" className="rw-btn" disabled={sharing || !shareUrl.trim()}>
                        {sharing ? "Sending…" : "Send my post"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="rw-small">Send your results screenshot first, then share it.</p>
                )}
              </>
            )}
          </div>
        </li>

        {/* giveaway */}
        {snap.giveaway && (
          <li className="rw-step" data-state={snap.giveaway.chances > 0 ? "done" : "active"}>
            <span className="rw-step-num" aria-hidden="true">★</span>
            <div className="rw-step-body">
              <div className="rw-step-title">
                <h3>{snap.giveaway.title}</h3>
                <span className="rw-pill" data-tone={snap.giveaway.chances > 0 ? "live" : "wait"}>
                  {snap.giveaway.chances > 0 ? `${snap.giveaway.chances} ${snap.giveaway.chances === 1 ? "chance" : "chances"}` : "Not entered"}
                </span>
              </div>
              <p className="rw-muted">
                Prize: {snap.giveaway.prize}. Closes {formatDate(snap.giveaway.endsAt)}. An approved
                results screenshot and an approved shared post each add one extra chance.
              </p>
              <Link className="rw-btn rw-btn--ghost rw-btn--small" href="/giveaway">
                {snap.giveaway.chances > 0 ? "See the rules" : "Enter the giveaway"}
              </Link>
            </div>
          </li>
        )}
      </ol>
      {loadError && <p className="rw-error" role="alert" style={{ marginTop: "12px" }}>{loadError}</p>}
    </div>
  );
}
