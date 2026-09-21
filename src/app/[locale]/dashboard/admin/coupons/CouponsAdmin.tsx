"use client";

import { useState, useTransition } from "react";
import {
  TablePager,
  TableToolbar,
  useTableView,
  type FilterDef,
  type SortDef,
} from "@/components/dashboard/table-view";
import { createCoupon, deleteCoupon, setCouponActive } from "./actions";

export type CouponRow = {
  id: string;
  code: string;
  kind: "PERCENT" | "FIXED" | "FREE";
  value: number;
  robotName: string | null;
  tier: string | null;
  maxRedemptions: number | null;
  redeemedCount: number;
  oncePerEmail: boolean;
  expiresAt: string | null;
  active: boolean;
  note: string | null;
  createdAt: string;
};

export type RobotOption = { id: string; name: string };

type Notice = { kind: "ok" | "error"; text: string } | null;

const TIERS = [
  "FREE_TRIAL",
  "TEN_DAYS",
  "ONE_MONTH",
  "SIX_MONTHS",
  "ONE_YEAR",
  "LIFETIME",
  "LIFETIME_SOURCE",
];

function describe(c: CouponRow) {
  if (c.kind === "FREE") return "100% — free";
  if (c.kind === "PERCENT") return `${c.value}% off`;
  return `$${c.value} off`;
}

function state(c: CouponRow) {
  if (!c.active) return { label: "Off", tone: "off" as const };
  if (c.expiresAt && new Date(c.expiresAt) < new Date()) return { label: "Expired", tone: "bad" as const };
  if (c.maxRedemptions != null && c.redeemedCount >= c.maxRedemptions)
    return { label: "Used up", tone: "bad" as const };
  return { label: "Live", tone: "live" as const };
}

const FILTERS: FilterDef<CouponRow>[] = [
  { key: "live", label: "Live", test: (c) => state(c).tone === "live" },
  { key: "free", label: "Free codes", test: (c) => c.kind === "FREE" },
  { key: "used", label: "Used at least once", test: (c) => c.redeemedCount > 0 },
  { key: "off", label: "Switched off", test: (c) => !c.active },
];

const SORTS: SortDef<CouponRow>[] = [
  { key: "newest", label: "Newest first", compare: (a, b) => b.createdAt.localeCompare(a.createdAt) },
  { key: "uses", label: "Most used", compare: (a, b) => b.redeemedCount - a.redeemedCount },
  { key: "code", label: "Code A–Z", compare: (a, b) => a.code.localeCompare(b.code) },
];

export default function CouponsAdmin({
  coupons,
  robots,
}: {
  coupons: CouponRow[];
  robots: RobotOption[];
}) {
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    code: "",
    kind: "FREE" as "PERCENT" | "FIXED" | "FREE",
    value: 100,
    robotId: "",
    tier: "",
    maxRedemptions: "",
    oncePerEmail: true,
    expiresAt: "",
    note: "",
  });

  const view = useTableView(coupons, {
    search: (c, q) =>
      c.code.toLowerCase().includes(q) || (c.note ?? "").toLowerCase().includes(q),
    filters: FILTERS,
    sorts: SORTS,
    pageSize: 25,
  });

  const run = (fn: () => Promise<string | void>) =>
    start(async () => {
      setNotice(null);
      try {
        const text = await fn();
        if (text) setNotice({ kind: "ok", text });
      } catch (err) {
        setNotice({
          kind: "error",
          text: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    });

  return (
    <>
      <section className="card" style={{ marginBottom: "20px" }}>
        <div className="admin-table-head">
          <div>
            <p className="card-label">New code</p>
            <h2 style={{ fontSize: "1.15rem", margin: 0 }}>Create a coupon</h2>
          </div>
        </div>

        {notice && <p className={`admin-notice is-${notice.kind}`}>{notice.text}</p>}

        <div className="settings-grid">
          <label>
            <span className="card-label">Code</span>
            <input
              className="enroll-input"
              style={{ marginTop: "8px", letterSpacing: "0.08em" }}
              placeholder="LAUNCH-2026"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            />
          </label>

          <label>
            <span className="card-label">Type</span>
            <select
              className="enroll-input"
              style={{ marginTop: "8px" }}
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as typeof form.kind })}
            >
              <option value="FREE">Free — skips payment entirely</option>
              <option value="PERCENT">Percent off</option>
              <option value="FIXED">Fixed amount off</option>
            </select>
          </label>

          {form.kind !== "FREE" && (
            <label>
              <span className="card-label">{form.kind === "PERCENT" ? "Percent" : "Amount ($)"}</span>
              <input
                className="enroll-input"
                style={{ marginTop: "8px" }}
                inputMode="decimal"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: Number(e.target.value) || 0 })}
              />
            </label>
          )}

          <label>
            <span className="card-label">Robot</span>
            <select
              className="enroll-input"
              style={{ marginTop: "8px" }}
              value={form.robotId}
              onChange={(e) => setForm({ ...form, robotId: e.target.value })}
            >
              <option value="">Any robot</option>
              {robots.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="card-label">Plan</span>
            <select
              className="enroll-input"
              style={{ marginTop: "8px" }}
              value={form.tier}
              onChange={(e) => setForm({ ...form, tier: e.target.value })}
            >
              <option value="">Any plan</option>
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ").toLowerCase()}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="card-label">Max uses</span>
            <input
              className="enroll-input"
              style={{ marginTop: "8px" }}
              inputMode="numeric"
              placeholder="unlimited"
              value={form.maxRedemptions}
              onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
            />
          </label>

          <label>
            <span className="card-label">Expires</span>
            <input
              className="enroll-input"
              style={{ marginTop: "8px" }}
              type="date"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            />
          </label>

          <label>
            <span className="card-label">Note (admin only)</span>
            <input
              className="enroll-input"
              style={{ marginTop: "8px" }}
              placeholder="who it's for"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </label>
        </div>

        <label style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "16px", fontSize: "0.88rem" }}>
          <input
            type="checkbox"
            checked={form.oncePerEmail}
            onChange={(e) => setForm({ ...form, oncePerEmail: e.target.checked })}
          />
          One use per email address
        </label>

        <div style={{ marginTop: "20px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn-primary btn-sm"
            disabled={pending || !form.code.trim()}
            onClick={() =>
              run(async () => {
                const res = await createCoupon({
                  code: form.code,
                  kind: form.kind,
                  value: form.value,
                  robotId: form.robotId || null,
                  tier: form.tier || null,
                  maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
                  oncePerEmail: form.oncePerEmail,
                  expiresAt: form.expiresAt || null,
                  note: form.note || null,
                });
                setForm({ ...form, code: "", note: "" });
                return `${res.code} created.`;
              })
            }
          >
            {pending ? "Working…" : "Create coupon"}
          </button>
          <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
            A free code creates the licence immediately — no payment page, same emails and compile.
          </span>
        </div>
      </section>

      <section className="card">
        <div className="admin-table-head">
          <div>
            <p className="card-label">Codes</p>
            <h2 style={{ fontSize: "1.15rem", margin: 0 }}>All coupons</h2>
          </div>
        </div>

        <TableToolbar view={view} filters={FILTERS} sorts={SORTS} searchPlaceholder="Search code or note…" />

        <div className="table-wrap">
          <table className="data-table is-wide">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Scope</th>
                <th>Uses</th>
                <th>State</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {view.pageRows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                    {coupons.length === 0 ? "No coupons yet." : "Nothing matches those filters."}
                  </td>
                </tr>
              )}
              {view.pageRows.map((c) => {
                const s = state(c);
                return (
                  <tr key={c.id} data-dim={c.active ? undefined : "true"}>
                    <td data-label="Code">
                      <span className="cell-stack">
                        <span className="robot-name" style={{ letterSpacing: "0.06em" }}>{c.code}</span>
                        {c.note && <span className="cell-note">{c.note}</span>}
                      </span>
                    </td>
                    <td data-label="Discount">{describe(c)}</td>
                    <td data-label="Scope">
                      <span className="cell-stack">
                        <span>{c.robotName ?? "Any robot"}</span>
                        <span className="cell-note">
                          {c.tier ? c.tier.replace(/_/g, " ").toLowerCase() : "any plan"}
                          {c.oncePerEmail ? " · one per email" : ""}
                        </span>
                      </span>
                    </td>
                    <td data-label="Uses">
                      <span className="cell-stack">
                        <span>
                          {c.redeemedCount}
                          {c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ""}
                        </span>
                        {c.expiresAt && (
                          <span className="cell-note">
                            until {new Date(c.expiresAt).toLocaleDateString()}
                          </span>
                        )}
                      </span>
                    </td>
                    <td data-label="State">
                      <span className="pill" data-tone={s.tone}>
                        {s.label}
                      </span>
                    </td>
                    <td data-label="Actions" className="cell-actions">
                      <div className="row-actions">
                        <button
                          type="button"
                          className={`btn-mini ${c.active ? "is-danger" : "is-go"}`}
                          disabled={pending}
                          onClick={() =>
                            run(async () => {
                              await setCouponActive(c.id, !c.active);
                              return c.active ? `${c.code} switched off.` : `${c.code} is live.`;
                            })
                          }
                        >
                          {c.active ? "Switch off" : "Switch on"}
                        </button>
                        {c.redeemedCount === 0 && (
                          <button
                            type="button"
                            className="btn-mini"
                            disabled={pending}
                            onClick={() =>
                              run(async () => {
                                await deleteCoupon(c.id);
                                return `${c.code} deleted.`;
                              })
                            }
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <TablePager view={view} noun="coupons" />
      </section>
    </>
  );
}
