"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { openSupportChat } from "@/components/NdeskWidget";
import {
  CLIENT_POLL_INITIAL_MS,
  CLIENT_POLL_MAX_MS,
  CLIENT_POLL_TIMEOUT_MS,
} from "@/lib/compiler-config";

interface LicenseManagerProps {
  subscription: {
    id: string;
    tier: string;
    mt5AccountNumber: string | null;
    status: string;
  };
  robotName: string;
  robotSlug: string;
  /** How the next MT5 account change on this licence would be covered (src/lib/mt5-changes.ts). */
  changeQuote: { allowance: "free" | "credit" | "payment"; fee: number | null };
  latestCompilation: {
    id: string;
    status: string;
    downloadUrl: string | null;
    updatedAt: string | Date;
  } | null;
}

export default function LicenseManager({
  subscription,
  robotName,
  robotSlug,
  changeQuote,
  latestCompilation: initialCompilation,
}: LicenseManagerProps) {
  const [mt5Account, setMt5Account] = useState(subscription.mt5AccountNumber || "");
  const [isEditing, setIsEditing] = useState(!subscription.mt5AccountNumber);
  const [isUpdating, setIsUpdating] = useState(false);
  const [compilation, setCompilation] = useState(initialCompilation);
  const [isPolling, setIsPolling] = useState(initialCompilation?.status === "PENDING" || initialCompilation?.status === "PROCESSING");
  const [timedOut, setTimedOut] = useState(false);
  const router = useRouter();
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  // Changing the account on a licence that already has one. The first change
  // is free; after that the fee is half the plan price, paid before the change.
  const [changing, setChanging] = useState(false);
  const [feeDue, setFeeDue] = useState<number | null>(null);
  const [payingBy, setPayingBy] = useState<"card" | "crypto" | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const lockedAccount = subscription.mt5AccountNumber;
  const needsPayment = changeQuote.allowance === "payment" || feeDue !== null;
  const fee = feeDue ?? changeQuote.fee;

  const startChange = () => {
    setChanging(true);
    setIsEditing(true);
    setMt5Account("");
    setPayError(null);
  };
  const cancelChange = () => {
    setChanging(false);
    setIsEditing(false);
    setMt5Account(lockedAccount || "");
    setFeeDue(null);
    setPayError(null);
  };
  const payForChange = async (method: "card" | "crypto") => {
    setPayingBy(method);
    setPayError(null);
    try {
      const res = await fetch("/api/checkout/account-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: subscription.id, method, locale }),
      });
      const data = await res.json();
      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setPayError(data.error || "Could not start the payment. Please try again.");
    } catch {
      setPayError("Could not start the payment. Please try again.");
    } finally {
      setPayingBy(null);
    }
  };

  // Bounded polling loop:
  //   - starts at CLIENT_POLL_INITIAL_MS (5s), backs off 1.5x up to CLIENT_POLL_MAX_MS (30s)
  //   - hard-caps at CLIENT_POLL_TIMEOUT_MS (5min) wall clock
  //   - transitions to TIMED_OUT UI state on cap; stops all further requests
  //   - cleans up the pending timer on unmount / dependency change
  useEffect(() => {
    if (!isPolling || !compilation?.id) return;

    const startedAt = Date.now();
    let delay = CLIENT_POLL_INITIAL_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      if (Date.now() - startedAt > CLIENT_POLL_TIMEOUT_MS) {
        setIsPolling(false);
        setTimedOut(true);
        return;
      }
      try {
        const res = await fetch(`/api/licenses/status?jobId=${compilation.id}`);
        const data = await res.json();
        if (data.status === "COMPLETED" || data.status === "FAILED") {
          setCompilation(data);
          setIsPolling(false);
          router.refresh();
          return;
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
      delay = Math.min(delay * 1.5, CLIENT_POLL_MAX_MS);
      if (!cancelled) {
        timer = setTimeout(tick, delay);
      }
    };

    timer = setTimeout(tick, delay);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isPolling, compilation?.id, router]);

  const handleUpdateMt5 = async () => {
    if (!mt5Account) return;
    if (changing && changeQuote.allowance === "free" && feeDue === null) {
      const ok = window.confirm(
        `Change the MT5 account on this licence to ${mt5Account}?\n\nThis uses your one included change. Any change after it costs half of your plan's price.`,
      );
      if (!ok) return;
    }
    // Clear stale timeout state so a fresh compile retry can poll again.
    setTimedOut(false);
    setIsUpdating(true);
    try {
      const res = await fetch("/api/licenses/update-mt5", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: subscription.id, mt5AccountNumber: mt5Account }),
      });
      const data = await res.json();
      if (res.status === 402 && data.code === "mt5-change-limit") {
        // Over the limit: the change is for sale, not refused.
        setFeeDue(typeof data.fee === "number" ? data.fee : changeQuote.fee);
        return;
      }
      if (data.success) {
        setChanging(false);
        setFeeDue(null);
        setIsEditing(false);
        setCompilation(data.job);
        setIsPolling(true);
        router.refresh();
      } else {
        alert(data.error || "Failed to update MT5 account.");
      }
    } catch {
      alert("Error updating MT5 account.");
    } finally {
      setIsUpdating(false);
    }
  };

  const statusColor = compilation?.status === "COMPLETED" ? "var(--accent-accent)" :
    compilation?.status === "FAILED" ? "#ff4444" : "var(--accent-primary)";

  return (
    <div className="glass-panel" style={{ marginBottom: "2rem" }}>
      <div className="licence-head">
        <div>
          <h3 className="licence-title">{robotName}</h3>
          <p className="robot-slug">AL-ai-FX_{robotSlug}.ex5</p>
          <p style={{ color: "var(--accent-primary)", fontSize: "0.9rem", fontWeight: 600 }}>{subscription.tier.replace("_", " ")} {t("access")}</p>
        </div>
        <div>
          <span className="badge" style={{ position: "relative", top: 0, left: 0, transform: "none" }}>{subscription.status}</span>
        </div>
      </div>

      <div className="licence-grid">
        <div>
          <p className="licence-step-label">{t("stepOneLabel")}</p>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>{t("lockedMt5Account")}</p>
          <div className="licence-mt5-row">
            <input
              type="text"
              value={mt5Account}
              onChange={(e) => setMt5Account(e.target.value)}
              disabled={!isEditing}
              placeholder={t("enterMt5Id")}
              style={{
                padding: "0.8rem",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-color)",
                background: "rgba(0,0,0,0.2)",
                color: "var(--text-primary)",
                fontFamily: "inherit",
                width: "100%",
              }}
            />
            {isEditing && (
              <button
                className="btn-primary"
                onClick={handleUpdateMt5}
                disabled={isUpdating}
                style={{ whiteSpace: "nowrap", padding: "0.8rem 1.5rem" }}
              >
                {isUpdating ? t("saving") : t("saveAndLock")}
              </button>
            )}
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
            {isEditing ? t("importantSetOnce") : t("mt5LockedPermanently")}
          </p>
          {!isEditing && lockedAccount && (
            <button
              type="button"
              onClick={startChange}
              style={{ marginTop: "0.5rem", background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--accent-primary)", fontWeight: 600, fontSize: "0.85rem", fontFamily: "inherit" }}
            >
              {t("changeAccount")}
            </button>
          )}
          {changing && (
            <div style={{ marginTop: "0.75rem", padding: "0.9rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", background: "rgba(0,0,0,0.15)", fontSize: "0.85rem" }}>
              {changeQuote.allowance === "credit" ? (
                <p style={{ margin: 0 }}>You have a paid account change ready for this licence. Enter the new number and save.</p>
              ) : needsPayment ? (
                <>
                  <p style={{ margin: "0 0 0.6rem 0" }}>
                    You have used the one MT5 account change that is included. Another change costs half of your
                    plan&apos;s price{fee !== null ? `: $${fee.toFixed(2)}` : ""}. Pay it once, then come back to
                    this page and enter the new number.
                  </p>
                  {fee !== null ? (
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button className="btn-primary" disabled={payingBy !== null} onClick={() => payForChange("card")} style={{ padding: "0.6rem 1.1rem" }}>
                        {payingBy === "card" ? "Opening…" : `Pay $${fee.toFixed(2)} by card`}
                      </button>
                      <button className="btn-secondary" disabled={payingBy !== null} onClick={() => payForChange("crypto")} style={{ padding: "0.6rem 1.1rem" }}>
                        {payingBy === "crypto" ? "Opening…" : `Pay $${fee.toFixed(2)} with crypto`}
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={openSupportChat} className="btn-secondary" style={{ padding: "0.6rem 1.1rem" }}>
                      Contact support
                    </button>
                  )}
                  {payError && <p style={{ color: "#ff6b6b", margin: "0.6rem 0 0 0" }}>{payError}</p>}
                </>
              ) : (
                <p style={{ margin: 0 }}>
                  This is your one included change. Any change after it costs half of your plan&apos;s price.
                </p>
              )}
              <p style={{ margin: "0.6rem 0 0 0" }}>
                <button
                  type="button"
                  onClick={cancelChange}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--text-muted)", fontFamily: "inherit", fontSize: "0.85rem", textDecoration: "underline" }}
                >
                  Keep {lockedAccount}
                </button>
              </p>
            </div>
          )}
        </div>

        <div className="licence-download">
          <p className="licence-step-label">{t("stepTwoLabel")}</p>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>{t("downloadLatestBuild")}</p>

          {compilation?.status === "COMPLETED" && compilation.id ? (
            <a
              href={`/api/compiler/download?jobId=${compilation.id}`}
              download
              className="btn-primary"
              style={{ textAlign: "center", textDecoration: "none" }}
            >
              {t("downloadLatestEx5")}
            </a>
          ) : (
            <>
              <button
                className="btn-primary"
                disabled={isPolling || !mt5Account || isEditing}
                style={{
                  border: "none",
                  alignSelf: "flex-start",
                  opacity: (isPolling || !mt5Account || isEditing) ? 0.45 : 1,
                  cursor: (isPolling || !mt5Account || isEditing) ? "not-allowed" : "pointer",
                  boxShadow: (isPolling || !mt5Account || isEditing) ? "none" : undefined,
                }}
                onClick={handleUpdateMt5}
              >
                {isPolling ? t("compiling", { status: compilation?.status || "" }) : t("compileAndDownloadEx5")}
              </button>
              {/* Testers tapped this button repeatedly with nothing happening: it is
                  disabled until the MT5 account is locked, which the UI never said. */}
              {!isPolling && (!mt5Account || isEditing) && (
                <p className="licence-blocked-hint">{t("compileNeedsMt5")}</p>
              )}
            </>
          )}

          {timedOut && (
            <p style={{ fontSize: "0.9rem", color: "#f4dca2", marginTop: "0.5rem", fontWeight: 500 }}>
              Compilation is taking longer than expected — an email will be sent when it&apos;s ready.
            </p>
          )}

          {compilation && (
            <p style={{ fontSize: "0.8rem", color: statusColor, marginTop: "0.5rem", fontWeight: 500 }}>
              {t("status")}: {compilation.status}
              {compilation.status === "FAILED" && t("failedCheckLater")}
            </p>
          )}
        </div>
      </div>

      {compilation?.status === "FAILED" && (
        <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(255, 68, 68, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255, 68, 68, 0.2)' }}>
          <h4 style={{ color: '#ff4444', marginBottom: '0.75rem', fontSize: '1rem' }}>We hit a snag building your robot</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Your build did not complete after several automatic retries. Our team has been notified — you have not been charged for a failed build. If you need anything in the meantime, reach out to us directly.
          </p>
          <button
            type="button"
            onClick={openSupportChat}
            style={{ display: 'inline-block', padding: '0.6rem 1.2rem', borderRadius: 'var(--radius-sm)', background: '#ff4444', color: '#fff', fontSize: '0.85rem', fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Contact support
          </button>
        </div>
      )}

      {compilation?.status === "COMPLETED" && (
        <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <h4 style={{ color: 'var(--accent-accent)', marginBottom: '1rem', fontSize: '1rem' }}>{t("successSteps")}</h4>
          {/* Ordered list, not a bullet list: these are sequential and the
              numbering carries meaning. `.next-steps` overrides the inherited
              `.glass-panel ul li { display:flex }`, which was splitting the
              step label and its text into two squeezed columns on phones. */}
          <ol className="next-steps">
            <li>{t("successStep1")}</li>
            <li>{t("successStep2")}</li>
            <li>{t("successStep3")}</li>
            <li>{t("successStep4")}</li>
            <li>{t.rich("successStep5", { tutorialLink: (chunks) => <Link href="/tutorials/2" style={{ textDecoration: 'underline', color: 'var(--accent-primary)' }}>{chunks}</Link> })}</li>
          </ol>
          <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            ⚠️ {t("successNote", { account: subscription.mt5AccountNumber || "" })}
          </p>
        </div>
      )}
    </div>
  );
}
