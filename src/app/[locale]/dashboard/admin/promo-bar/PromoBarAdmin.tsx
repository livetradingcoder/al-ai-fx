"use client";

import { useState, useTransition } from "react";

import Dialog from "@/components/dashboard/Dialog";
import type { ActionResult } from "@/lib/action-result";
import { formatDate } from "@/lib/format-date";
import { addCouponToBar, createBanner, deleteBanner, setBannerActive } from "./actions";

export type BannerRow = {
  id: string;
  message: string;
  couponCode: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  endsAt: string | null;
  active: boolean;
};

export type CouponOption = { code: string; label: string };

type Notice = { kind: "ok" | "error"; text: string } | null;

export default function PromoBarAdmin({
  banners,
  coupons,
  suggestions,
}: {
  banners: BannerRow[];
  coupons: CouponOption[];
  /** Public-safe coupons that are not in the bar yet. */
  suggestions: CouponOption[];
}) {
  const [notice, setNotice] = useState<Notice>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Fixed at load: "has it ended" does not need to tick.
  const [now] = useState(() => Date.now());
  const [form, setForm] = useState({ message: "", couponCode: "", ctaLabel: "", ctaPath: "", endsAt: "" });

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      setNotice(null);
      try {
        const res = await fn();
        setNotice(res.ok ? { kind: "ok", text: res.message } : { kind: "error", text: res.error });
      } catch {
        setNotice({ kind: "error", text: "Something went wrong" });
      }
    });

  const create = () =>
    start(async () => {
      setFormError(null);
      try {
        const res = await createBanner(form);
        if (res.ok) {
          setForm({ message: "", couponCode: "", ctaLabel: "", ctaPath: "", endsAt: "" });
          setCreating(false);
          setNotice({ kind: "ok", text: res.message });
        } else {
          setFormError(res.error);
        }
      } catch {
        setFormError("Something went wrong");
      }
    });

  return (
    <>
    {suggestions.length > 0 && (
      <section className="card" style={{ marginBottom: "20px" }}>
        <p className="card-label">One click</p>
        <h2 style={{ fontSize: "1.15rem", margin: "6px 0 6px" }}>Active coupons not in the bar yet</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", maxWidth: "70ch", marginBottom: "14px" }}>
          These codes are live and safe to show publicly. Add one and it appears in the top bar with a copy
          button, and in the pop-up people see when they are about to leave.
        </p>
        {notice && <p className={`admin-notice is-${notice.kind}`}>{notice.text}</p>}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Code</th><th>Discount</th><th style={{ textAlign: "right" }}>Action</th></tr>
            </thead>
            <tbody>
              {suggestions.map((c) => (
                <tr key={c.code}>
                  <td data-label="Code"><code>{c.code}</code></td>
                  <td data-label="Discount">{c.label}</td>
                  <td data-label="Action" style={{ textAlign: "right" }}>
                    <button type="button" className="btn-mini is-go" disabled={pending} onClick={() => run(() => addCouponToBar({ code: c.code }))}>
                      Show in bar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    )}

    <section className="card">
      <div className="admin-table-head">
        <div>
          <p className="card-label">Messages</p>
          <h2 style={{ fontSize: "1.15rem", margin: 0 }}>Top bar messages</h2>
        </div>
        <button type="button" className="btn-primary btn-sm" onClick={() => setCreating(true)}>
          New message
        </button>
      </div>

      <Dialog open={creating} onClose={() => setCreating(false)} eyebrow="New" title="Add a top bar message" wide>
        {formError && (
          <p className="admin-notice is-error" role="alert">
            {formError}
          </p>
        )}
        <div className="settings-grid">
          <label>
            <span className="card-label">Message (up to 90 characters)</span>
            <input
              className="enroll-input"
              style={{ marginTop: "8px" }}
              data-autofocus
              maxLength={90}
              placeholder="30% off every plan this week"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
          </label>
          <label>
            <span className="card-label">Coupon code to show (optional)</span>
            <select
              className="enroll-input"
              style={{ marginTop: "8px" }}
              value={form.couponCode}
              onChange={(e) => setForm({ ...form, couponCode: e.target.value })}
            >
              <option value="">No code, just a message</option>
              {coupons.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.label})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="card-label">Button text (optional)</span>
            <input
              className="enroll-input"
              style={{ marginTop: "8px" }}
              maxLength={24}
              placeholder={form.couponCode ? "Use code" : "Learn more"}
              value={form.ctaLabel}
              onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })}
            />
          </label>
          <label>
            <span className="card-label">Button goes to (optional page on this site)</span>
            <input
              className="enroll-input"
              style={{ marginTop: "8px" }}
              placeholder={form.couponCode ? "/checkout?coupon=… (default)" : "/catalog (default)"}
              value={form.ctaPath}
              onChange={(e) => setForm({ ...form, ctaPath: e.target.value })}
            />
          </label>
          <label>
            <span className="card-label">Ends (optional, shows a countdown)</span>
            <input
              className="enroll-input"
              style={{ marginTop: "8px" }}
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
            />
          </label>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginTop: "12px" }}>
          Leave the end date empty to use the code&apos;s own expiry (if it has one). The message hides by itself
          when the code expires or is used up.
        </p>
        <div style={{ marginTop: "20px" }}>
          <button type="button" className="btn-primary btn-sm" disabled={pending || !form.message.trim()} onClick={create}>
            {pending ? "Working…" : "Add message"}
          </button>
        </div>
      </Dialog>

      {notice && suggestions.length === 0 && <p className={`admin-notice is-${notice.kind}`}>{notice.text}</p>}

      <div className="table-wrap">
        <table className="data-table is-wide">
          <thead>
            <tr>
              <th>Message</th>
              <th>Code</th>
              <th>Ends</th>
              <th>State</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {banners.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                  No messages yet. The bar still shows the live giveaway and the share-for-discount reward.
                </td>
              </tr>
            )}
            {banners.map((b) => {
              const ended = b.endsAt !== null && new Date(b.endsAt).getTime() <= now;
              const state = !b.active ? { label: "Off", tone: "off" } : ended ? { label: "Ended", tone: "bad" } : { label: "Showing", tone: "live" };
              return (
                <tr key={b.id} data-dim={b.active && !ended ? undefined : "true"}>
                  <td data-label="Message">{b.message}</td>
                  <td data-label="Code">{b.couponCode ? <code>{b.couponCode}</code> : "—"}</td>
                  <td data-label="Ends">{b.endsAt ? formatDate(b.endsAt) : "—"}</td>
                  <td data-label="State">
                    <span className="pill" data-tone={state.tone}>{state.label}</span>
                  </td>
                  <td data-label="Actions" style={{ textAlign: "right" }}>
                    <span style={{ display: "inline-flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="btn-mini"
                        disabled={pending}
                        onClick={() => run(() => setBannerActive({ id: b.id, active: !b.active }))}
                      >
                        {b.active ? "Hide" : "Show"}
                      </button>
                      <button
                        type="button"
                        className="btn-mini is-danger"
                        disabled={pending}
                        onClick={() => {
                          if (window.confirm("Delete this message?")) run(() => deleteBanner({ id: b.id }));
                        }}
                      >
                        Delete
                      </button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
    </>
  );
}
