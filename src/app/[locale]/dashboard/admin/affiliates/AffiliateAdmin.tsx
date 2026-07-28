"use client";

import { useState, useTransition } from "react";
import {
  TablePager,
  TableToolbar,
  useTableView,
  type FilterDef,
  type SortDef,
} from "@/components/dashboard/table-view";
import {
  approveCommission,
  approveDueCommissions,
  markPayoutPaid,
  rejectPayout,
  reverseCommission,
  saveProgramSettings,
  saveTiers,
  setAffiliateRate,
  setAffiliateStatus,
} from "./actions";

export type AffiliateRow = {
  id: string;
  email: string;
  code: string;
  status: string;
  rateOverride: number | null;
  effectiveRate: number;
  tierName: string;
  clicks: number;
  referrals: number;
  pending: number;
  approved: number;
  paid: number;
  lifetime: number;
  payoutMethod: string | null;
  payoutAddress: string | null;
  createdAt: string;
};

export type CommissionRow = {
  id: string;
  affiliateEmail: string;
  customer: string;
  amount: number;
  orderAmount: number;
  rate: number;
  status: string;
  holdUntil: string;
  createdAt: string;
};

export type PayoutRow = {
  id: string;
  affiliateEmail: string;
  amount: number;
  method: string | null;
  address: string | null;
  status: string;
  reference: string | null;
  requestedAt: string;
};

export type Settings = {
  cookieDays: number;
  defaultRate: number;
  referredDiscount: number;
  minPayout: number;
  holdDays: number;
  tierBasis: "VOLUME" | "REFERRALS";
  lifetimeScope: boolean;
  blockSelfReferral: boolean;
};

export type Tier = { id: string; name: string; threshold: number; rate: number };

type Notice = { kind: "ok" | "error"; text: string } | null;

function useRunner(setNotice: (n: Notice) => void) {
  const [pending, start] = useTransition();
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
  return { pending, run };
}

/* ------------------------------------------------------------------ people */

const AFF_FILTERS: FilterDef<AffiliateRow>[] = [
  { key: "earning", label: "Has earned", test: (a) => a.lifetime > 0 },
  { key: "idle", label: "No sales yet", test: (a) => a.lifetime === 0 },
  { key: "owed", label: "Money owed", test: (a) => a.approved > 0 },
  { key: "suspended", label: "Suspended", test: (a) => a.status === "SUSPENDED" },
];

const AFF_SORTS: SortDef<AffiliateRow>[] = [
  { key: "earned", label: "Top earners", compare: (a, b) => b.lifetime - a.lifetime },
  { key: "owed", label: "Most owed", compare: (a, b) => b.approved - a.approved },
  { key: "referrals", label: "Most referrals", compare: (a, b) => b.referrals - a.referrals },
  { key: "newest", label: "Newest first", compare: (a, b) => b.createdAt.localeCompare(a.createdAt) },
];

export function AffiliatesPanel({ affiliates }: { affiliates: AffiliateRow[] }) {
  const [notice, setNotice] = useState<Notice>(null);
  const { pending, run } = useRunner(setNotice);
  const [editing, setEditing] = useState<string | null>(null);
  const [rate, setRate] = useState("");

  const view = useTableView(affiliates, {
    search: (a, q) => a.email.toLowerCase().includes(q) || a.code.toLowerCase().includes(q),
    filters: AFF_FILTERS,
    sorts: AFF_SORTS,
    pageSize: 25,
  });

  return (
    <section className="card" style={{ marginBottom: "20px" }}>
      <div className="admin-table-head">
        <div>
          <p className="card-label">People</p>
          <h2 style={{ fontSize: "1.15rem", margin: 0 }}>Affiliates</h2>
        </div>
      </div>

      {notice && <p className={`admin-notice is-${notice.kind}`}>{notice.text}</p>}

      <TableToolbar
        view={view}
        filters={AFF_FILTERS}
        sorts={AFF_SORTS}
        searchPlaceholder="Search email or code…"
      />

      <div className="table-wrap">
        <table className="data-table is-wide">
          <thead>
            <tr>
              <th>Affiliate</th>
              <th>Rate</th>
              <th>Traffic</th>
              <th>Earned</th>
              <th>Owed</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {view.pageRows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                  {affiliates.length === 0 ? "Nobody has joined yet." : "No affiliates match."}
                </td>
              </tr>
            )}
            {view.pageRows.map((a) => (
              <tr key={a.id} data-dim={a.status === "SUSPENDED" ? "true" : undefined}>
                <td data-label="Affiliate">
                  <span className="cell-stack">
                    <span className="robot-name">{a.email}</span>
                    <span className="robot-slug">{a.code}</span>
                  </span>
                </td>

                <td data-label="Rate">
                  {editing === a.id ? (
                    <span className="row-actions" style={{ justifyContent: "flex-start" }}>
                      <input
                        className="enroll-input"
                        style={{ width: "80px" }}
                        value={rate}
                        onChange={(e) => setRate(e.target.value)}
                        placeholder="%"
                        inputMode="decimal"
                      />
                      <button
                        type="button"
                        className="btn-mini is-go"
                        disabled={pending}
                        onClick={() =>
                          run(async () => {
                            await setAffiliateRate(a.id, rate.trim() === "" ? null : Number(rate));
                            setEditing(null);
                            return `${a.email} now earns ${rate.trim() === "" ? "the tier rate" : `${rate}%`}.`;
                          })
                        }
                      >
                        Save
                      </button>
                      <button type="button" className="btn-mini" onClick={() => setEditing(null)}>
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <span className="cell-stack">
                      <span>{a.effectiveRate}%</span>
                      <span className="cell-note">
                        {a.rateOverride != null ? "custom" : a.tierName}
                      </span>
                    </span>
                  )}
                </td>

                <td data-label="Traffic">
                  <span className="cell-stack">
                    <span>{a.referrals} referred</span>
                    <span className="cell-note">{a.clicks} clicks</span>
                  </span>
                </td>

                <td data-label="Earned">
                  <span className="cell-stack">
                    <span>${a.lifetime.toFixed(2)}</span>
                    <span className="cell-note">${a.paid.toFixed(2)} paid</span>
                  </span>
                </td>

                <td data-label="Owed">
                  <span className="cell-stack">
                    <span style={{ fontWeight: 600 }}>${a.approved.toFixed(2)}</span>
                    <span className="cell-note">${a.pending.toFixed(2)} on hold</span>
                  </span>
                </td>

                <td data-label="Actions" className="cell-actions">
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn-mini"
                      onClick={() => {
                        setEditing(a.id);
                        setRate(a.rateOverride != null ? String(a.rateOverride) : "");
                      }}
                    >
                      Set rate
                    </button>
                    <button
                      type="button"
                      className={`btn-mini ${a.status === "SUSPENDED" ? "is-go" : "is-danger"}`}
                      disabled={pending}
                      onClick={() =>
                        run(async () => {
                          await setAffiliateStatus(a.id, a.status !== "SUSPENDED");
                          return a.status === "SUSPENDED"
                            ? `${a.email} reinstated.`
                            : `${a.email} suspended — their links stop attributing.`;
                        })
                      }
                    >
                      {a.status === "SUSPENDED" ? "Reinstate" : "Suspend"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TablePager view={view} noun="affiliates" />
    </section>
  );
}

/* ------------------------------------------------------------- commissions */

const COM_FILTERS: FilterDef<CommissionRow>[] = [
  { key: "due", label: "Due for approval", test: (c) => c.status === "PENDING" && new Date(c.holdUntil) <= new Date() },
  { key: "pending", label: "On hold", test: (c) => c.status === "PENDING" },
  { key: "approved", label: "Approved", test: (c) => c.status === "APPROVED" },
  { key: "paid", label: "Paid", test: (c) => c.status === "PAID" },
  { key: "reversed", label: "Reversed", test: (c) => c.status === "REVERSED" },
];

const COM_SORTS: SortDef<CommissionRow>[] = [
  { key: "newest", label: "Newest first", compare: (a, b) => b.createdAt.localeCompare(a.createdAt) },
  { key: "amount", label: "Biggest first", compare: (a, b) => b.amount - a.amount },
];

export function CommissionsPanel({ commissions }: { commissions: CommissionRow[] }) {
  const [notice, setNotice] = useState<Notice>(null);
  const { pending, run } = useRunner(setNotice);

  const view = useTableView(commissions, {
    search: (c, q) =>
      c.affiliateEmail.toLowerCase().includes(q) || c.customer.toLowerCase().includes(q),
    filters: COM_FILTERS,
    sorts: COM_SORTS,
    pageSize: 25,
  });

  const due = commissions.filter(
    (c) => c.status === "PENDING" && new Date(c.holdUntil) <= new Date(),
  ).length;

  return (
    <section className="card" style={{ marginBottom: "20px" }}>
      <div className="admin-table-head">
        <div>
          <p className="card-label">Money</p>
          <h2 style={{ fontSize: "1.15rem", margin: 0 }}>Commissions</h2>
        </div>
        <button
          type="button"
          className="btn-primary btn-sm"
          disabled={pending || due === 0}
          onClick={() =>
            run(async () => {
              const res = await approveDueCommissions();
              return `${res.approved} commission${res.approved === 1 ? "" : "s"} approved.`;
            })
          }
        >
          {due > 0 ? `Approve ${due} past hold` : "Nothing due"}
        </button>
      </div>

      {notice && <p className={`admin-notice is-${notice.kind}`}>{notice.text}</p>}

      <TableToolbar
        view={view}
        filters={COM_FILTERS}
        sorts={COM_SORTS}
        searchPlaceholder="Search affiliate or customer…"
      />

      <div className="table-wrap">
        <table className="data-table is-wide">
          <thead>
            <tr>
              <th>Affiliate</th>
              <th>Customer</th>
              <th>Order</th>
              <th>Commission</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {view.pageRows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                  {commissions.length === 0 ? "No commissions yet." : "Nothing matches."}
                </td>
              </tr>
            )}
            {view.pageRows.map((c) => (
              <tr key={c.id} data-dim={c.status === "REVERSED" ? "true" : undefined}>
                <td data-label="Affiliate">{c.affiliateEmail}</td>
                <td data-label="Customer">{c.customer}</td>
                <td data-label="Order">${c.orderAmount.toFixed(2)}</td>
                <td data-label="Commission">
                  <span className="cell-stack">
                    <span style={{ fontWeight: 600 }}>${c.amount.toFixed(2)}</span>
                    <span className="cell-note">{c.rate}%</span>
                  </span>
                </td>
                <td data-label="Status">
                  <span
                    className="pill"
                    data-tone={
                      c.status === "PAID" || c.status === "APPROVED"
                        ? "live"
                        : c.status === "PENDING"
                          ? "soon"
                          : "bad"
                    }
                  >
                    {c.status}
                  </span>
                  {c.status === "PENDING" && (
                    <span className="cell-note">
                      clears {new Date(c.holdUntil).toLocaleDateString()}
                    </span>
                  )}
                </td>
                <td data-label="Actions" className="cell-actions">
                  <div className="row-actions">
                    {c.status === "PENDING" && (
                      <button
                        type="button"
                        className="btn-mini is-go"
                        disabled={pending}
                        onClick={() => run(async () => {
                          await approveCommission(c.id);
                          return "Approved.";
                        })}
                      >
                        Approve
                      </button>
                    )}
                    {(c.status === "PENDING" || c.status === "APPROVED") && (
                      <button
                        type="button"
                        className="btn-mini is-danger"
                        disabled={pending}
                        onClick={() => {
                          const reason = prompt("Why is this being reversed?") ?? "";
                          if (!reason) return;
                          run(async () => {
                            await reverseCommission(c.id, reason);
                            return "Reversed.";
                          });
                        }}
                      >
                        Reverse
                      </button>
                    )}
                    {c.status === "PAID" && <span className="cell-note">settled</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TablePager view={view} noun="commissions" />
    </section>
  );
}

/* ----------------------------------------------------------------- payouts */

export function PayoutsPanel({ payouts }: { payouts: PayoutRow[] }) {
  const [notice, setNotice] = useState<Notice>(null);
  const { pending, run } = useRunner(setNotice);

  const open = payouts.filter((p) => p.status === "REQUESTED");

  return (
    <section className="card" style={{ marginBottom: "20px" }}>
      <div className="admin-table-head">
        <div>
          <p className="card-label">Money out</p>
          <h2 style={{ fontSize: "1.15rem", margin: 0 }}>Payout requests</h2>
        </div>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.82rem" }}>
          {open.length} waiting · $
          {open.reduce((s, p) => s + p.amount, 0).toFixed(2)} to send
        </p>
      </div>

      {notice && <p className={`admin-notice is-${notice.kind}`}>{notice.text}</p>}

      <div className="table-wrap">
        <table className="data-table is-wide">
          <thead>
            <tr>
              <th>Affiliate</th>
              <th>Amount</th>
              <th>Send to</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {payouts.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                  No payout requests.
                </td>
              </tr>
            )}
            {payouts.map((p) => (
              <tr key={p.id}>
                <td data-label="Affiliate">
                  <span className="cell-stack">
                    <span className="robot-name">{p.affiliateEmail}</span>
                    <span className="robot-slug">
                      {new Date(p.requestedAt).toLocaleDateString()}
                    </span>
                  </span>
                </td>
                <td data-label="Amount" style={{ fontWeight: 600 }}>
                  ${p.amount.toFixed(2)}
                </td>
                <td data-label="Send to">
                  <span className="cell-stack">
                    <span>{p.method ?? "—"}</span>
                    <span className="cell-note">{p.address ?? "no address on file"}</span>
                  </span>
                </td>
                <td data-label="Status">
                  <span
                    className="pill"
                    data-tone={p.status === "PAID" ? "live" : p.status === "REJECTED" ? "bad" : "soon"}
                  >
                    {p.status}
                  </span>
                  {p.reference && <span className="cell-note">{p.reference}</span>}
                </td>
                <td data-label="Actions" className="cell-actions">
                  <div className="row-actions">
                    {p.status === "REQUESTED" ? (
                      <>
                        <button
                          type="button"
                          className="btn-mini is-go"
                          disabled={pending}
                          onClick={() => {
                            const reference = prompt("Transaction reference?") ?? "";
                            run(async () => {
                              await markPayoutPaid(p.id, reference);
                              return `Marked $${p.amount.toFixed(2)} as paid.`;
                            });
                          }}
                        >
                          Mark paid
                        </button>
                        <button
                          type="button"
                          className="btn-mini is-danger"
                          disabled={pending}
                          onClick={() => {
                            const note = prompt("Why is this rejected?") ?? "";
                            if (!note) return;
                            run(async () => {
                              await rejectPayout(p.id, note);
                              return "Rejected — the commissions are payable again.";
                            });
                          }}
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <span className="cell-note">closed</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- settings */

export function SettingsPanel({ settings, tiers }: { settings: Settings; tiers: Tier[] }) {
  const [notice, setNotice] = useState<Notice>(null);
  const { pending, run } = useRunner(setNotice);
  const [form, setForm] = useState(settings);
  const [ladder, setLadder] = useState(tiers);

  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <section className="card">
      <div className="admin-table-head">
        <div>
          <p className="card-label">Programme</p>
          <h2 style={{ fontSize: "1.15rem", margin: 0 }}>Rules and rates</h2>
        </div>
      </div>

      {notice && <p className={`admin-notice is-${notice.kind}`}>{notice.text}</p>}

      <div className="settings-grid">
        <label>
          <span className="card-label">Cookie window (days)</span>
          <input
            className="enroll-input"
            style={{ marginTop: "8px" }}
            value={form.cookieDays}
            inputMode="numeric"
            onChange={(e) => setForm({ ...form, cookieDays: num(e.target.value) })}
          />
        </label>
        <label>
          <span className="card-label">Hold before payable (days)</span>
          <input
            className="enroll-input"
            style={{ marginTop: "8px" }}
            value={form.holdDays}
            inputMode="numeric"
            onChange={(e) => setForm({ ...form, holdDays: num(e.target.value) })}
          />
        </label>
        <label>
          <span className="card-label">Referred discount (%)</span>
          <input
            className="enroll-input"
            style={{ marginTop: "8px" }}
            value={form.referredDiscount}
            inputMode="decimal"
            onChange={(e) => setForm({ ...form, referredDiscount: num(e.target.value) })}
          />
        </label>
        <label>
          <span className="card-label">Minimum payout ($)</span>
          <input
            className="enroll-input"
            style={{ marginTop: "8px" }}
            value={form.minPayout}
            inputMode="decimal"
            onChange={(e) => setForm({ ...form, minPayout: num(e.target.value) })}
          />
        </label>
        <label>
          <span className="card-label">Fallback rate (%)</span>
          <input
            className="enroll-input"
            style={{ marginTop: "8px" }}
            value={form.defaultRate}
            inputMode="decimal"
            onChange={(e) => setForm({ ...form, defaultRate: num(e.target.value) })}
          />
        </label>
        <label>
          <span className="card-label">Tiers based on</span>
          <select
            className="enroll-input"
            style={{ marginTop: "8px" }}
            value={form.tierBasis}
            onChange={(e) => setForm({ ...form, tierBasis: e.target.value as Settings["tierBasis"] })}
          >
            <option value="VOLUME">Commission earned ($)</option>
            <option value="REFERRALS">Referrals who bought</option>
          </select>
        </label>
      </div>

      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginTop: "18px" }}>
        <label style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "0.88rem" }}>
          <input
            type="checkbox"
            checked={form.lifetimeScope}
            onChange={(e) => setForm({ ...form, lifetimeScope: e.target.checked })}
          />
          Pay on every order, not just the first
        </label>
        <label style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "0.88rem" }}>
          <input
            type="checkbox"
            checked={form.blockSelfReferral}
            onChange={(e) => setForm({ ...form, blockSelfReferral: e.target.checked })}
          />
          Block self-referral
        </label>
      </div>

      <p className="card-label" style={{ marginTop: "26px" }}>
        Commission ladder
      </p>
      <div className="tier-editor">
        {ladder.map((tier, i) => (
          <div key={tier.id || i} className="tier-row">
            <input
              className="enroll-input"
              value={tier.name}
              placeholder="Tier name"
              onChange={(e) =>
                setLadder(ladder.map((t, j) => (j === i ? { ...t, name: e.target.value } : t)))
              }
            />
            <label className="toolbar-field">
              <span>from</span>
              <input
                className="enroll-input"
                style={{ width: "110px" }}
                value={tier.threshold}
                inputMode="decimal"
                onChange={(e) =>
                  setLadder(ladder.map((t, j) => (j === i ? { ...t, threshold: num(e.target.value) } : t)))
                }
              />
            </label>
            <label className="toolbar-field">
              <span>pays</span>
              <input
                className="enroll-input"
                style={{ width: "90px" }}
                value={tier.rate}
                inputMode="decimal"
                onChange={(e) =>
                  setLadder(ladder.map((t, j) => (j === i ? { ...t, rate: num(e.target.value) } : t)))
                }
              />
              <span>%</span>
            </label>
            <button
              type="button"
              className="btn-mini is-danger"
              onClick={() => setLadder(ladder.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn-mini"
          onClick={() => setLadder([...ladder, { id: "", name: "", threshold: 0, rate: 15 }])}
        >
          Add tier
        </button>
      </div>

      <div style={{ marginTop: "24px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn-primary btn-sm"
          disabled={pending}
          onClick={() =>
            run(async () => {
              await saveProgramSettings(form);
              await saveTiers(ladder);
              return "Programme updated. New rates apply to commissions from now on.";
            })
          }
        >
          {pending ? "Saving…" : "Save programme"}
        </button>
        <span style={{ color: "var(--text-muted)", fontSize: "0.82rem", alignSelf: "center" }}>
          Existing commissions keep the rate they were created with.
        </span>
      </div>
    </section>
  );
}
