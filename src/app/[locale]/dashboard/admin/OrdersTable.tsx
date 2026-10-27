"use client";

import { useMemo, useState } from "react";
import {
  TablePager,
  TableToolbar,
  useTableView,
  type FilterDef,
  type SortDef,
} from "@/components/dashboard/table-view";

export type OrderRow = {
  id: string;
  /**
   * A payment; a free trial (a licence with no payment behind it); or a payment
   * attempt that never became an order.
   */
  kind: "order" | "trial" | "attempt";
  email: string;
  tier: string;
  amount: number;
  currency: string;
  paygateId: string | null;
  /** Trials: the robot the trial is for. Attempts: the robot slug. */
  robotName?: string;
  /** Attempts only: whop | oxapay | polar. */
  provider?: string;
  /** Attempts only: why it did not complete, when we know. */
  detail?: string;
  /**
   * An order's payment status, a trial's licence status (ACTIVE, EXPIRED…), or
   * an attempt's: IN PROGRESS, ABANDONED, FAILED, CANCELED or ERROR.
   */
  status: string;
  createdAt: string;
};

// A trial has a licence status, not a payment status, so each payment filter
// names "an order" — otherwise every trial would land under Failed.
const FILTERS: FilterDef<OrderRow>[] = [
  { key: "success", label: "Paid", test: (r) => r.kind === "order" && r.status === "SUCCESS" },
  { key: "pending", label: "Pending", test: (r) => r.kind === "order" && r.status === "PENDING" },
  {
    key: "failed",
    label: "Failed",
    test: (r) => r.kind === "order" && r.status !== "SUCCESS" && r.status !== "PENDING",
  },
  { key: "attempts", label: "Not paid", test: (r) => r.kind === "attempt" },
];

const SORTS: SortDef<OrderRow>[] = [
  { key: "newest", label: "Newest first", compare: (a, b) => b.createdAt.localeCompare(a.createdAt) },
  { key: "oldest", label: "Oldest first", compare: (a, b) => a.createdAt.localeCompare(b.createdAt) },
  { key: "amount", label: "Largest amount", compare: (a, b) => b.amount - a.amount },
  { key: "email", label: "Email A–Z", compare: (a, b) => a.email.localeCompare(b.email) },
];

function tone(row: OrderRow) {
  if (row.kind === "trial") return row.status === "ACTIVE" ? "live" : "off";
  if (row.kind === "attempt") {
    if (row.status === "IN PROGRESS") return "soon";
    return row.status === "ABANDONED" || row.status === "CANCELED" ? "off" : "bad";
  }
  if (row.status === "SUCCESS") return "live";
  if (row.status === "PENDING") return "soon";
  return "bad";
}

export default function OrdersTable({ orders }: { orders: OrderRow[] }) {
  // Trials sit in the list so a new sign-up is visible, but they are not sales:
  // the chip takes them out so the list reads as payments only.
  const [showTrials, setShowTrials] = useState(true);
  const trialCount = useMemo(() => orders.filter((o) => o.kind === "trial").length, [orders]);
  // Attempts are people who pressed pay and did not complete: not sales either.
  const [showAttempts, setShowAttempts] = useState(true);
  const attemptCount = useMemo(() => orders.filter((o) => o.kind === "attempt").length, [orders]);
  const rows = useMemo(
    () =>
      orders.filter((o) =>
        o.kind === "trial" ? showTrials : o.kind === "attempt" ? showAttempts : true,
      ),
    [orders, showTrials, showAttempts],
  );

  const view = useTableView(rows, {
    // Paygate references are searchable: chasing a payment starts from the
    // reference the customer or the gateway quotes, not their email.
    search: (row, q) =>
      row.email.toLowerCase().includes(q) ||
      (row.paygateId ?? "").toLowerCase().includes(q) ||
      (row.robotName ?? "").toLowerCase().includes(q) ||
      (row.provider ?? "").toLowerCase().includes(q),
    filters: FILTERS,
    sorts: SORTS,
    pageSize: 10,
  });

  const paid = orders
    .filter((o) => o.kind === "order" && o.status === "SUCCESS")
    .reduce((sum, o) => sum + o.amount, 0);

  const emptyText =
    rows.length > 0
      ? "No orders match those filters."
      : trialCount > 0 && !showTrials
        ? "No payments yet — free trials are hidden."
        : attemptCount > 0 && !showAttempts
          ? "No payments yet — payment attempts are hidden."
          : "No orders yet.";

  return (
    <section className="card" style={{ marginTop: "20px" }}>
      <div className="admin-table-head">
        <div>
          <p className="card-label">Payments</p>
          <h2 style={{ fontSize: "1.15rem", margin: 0 }}>Orders</h2>
        </div>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.82rem" }}>
          ${paid.toLocaleString(undefined, { minimumFractionDigits: 2 })} collected
        </p>
      </div>

      <TableToolbar
        view={view}
        filters={FILTERS}
        sorts={SORTS}
        searchPlaceholder="Search email, robot or payment reference…"
      >
        <button
          type="button"
          className="toolbar-chip"
          aria-pressed={showTrials}
          title={showTrials ? "Hide free trials" : "Show free trials"}
          onClick={() => {
            setShowTrials((on) => !on);
            view.setPage(1);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path className="chip-tick" d="M8 12.5l2.7 2.7L16 9.5" />
          </svg>
          Free trials
          <span className="chip-count">{trialCount}</span>
        </button>
        <button
          type="button"
          className="toolbar-chip"
          aria-pressed={showAttempts}
          title={showAttempts ? "Hide payment attempts" : "Show payment attempts"}
          onClick={() => {
            setShowAttempts((on) => !on);
            view.setPage(1);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path className="chip-tick" d="M8 12.5l2.7 2.7L16 9.5" />
          </svg>
          Payment attempts
          <span className="chip-count">{attemptCount}</span>
        </button>
      </TableToolbar>

      <div className="table-wrap">
        <table className="data-table is-wide">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Tier</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Placed</th>
            </tr>
          </thead>
          <tbody>
            {view.pageRows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                  {emptyText}
                </td>
              </tr>
            )}
            {view.pageRows.map((row) => (
              <tr key={row.id}>
                <td data-label="Customer">
                  <span className="cell-stack">
                    <span className="robot-name">{row.email}</span>
                    <span className="robot-slug">
                      {row.kind === "trial"
                        ? `Free trial · ${row.robotName ?? "robot"}`
                        : row.kind === "attempt"
                          ? `Attempt · ${row.provider ?? "provider"} · ${row.robotName ?? "robot"}`
                          : (row.paygateId ?? "no reference")}
                    </span>
                    {row.kind === "attempt" && row.detail && (
                      <span className="robot-slug" style={{ color: "var(--text-muted)" }}>
                        {row.detail}
                      </span>
                    )}
                  </span>
                </td>
                <td data-label="Tier" style={{ whiteSpace: "nowrap" }}>
                  {row.tier.replace(/_/g, " ")}
                </td>
                <td data-label="Amount" style={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                  {row.kind === "trial"
                    ? "Free"
                    : row.kind === "attempt" && !row.amount
                      ? "—"
                      : `$${row.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${row.currency}`}
                </td>
                <td data-label="Status">
                  <span className="pill" data-tone={tone(row)}>
                    {row.status}
                  </span>
                </td>
                <td data-label="Placed" style={{ whiteSpace: "nowrap" }}>
                  {new Date(row.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TablePager view={view} noun="orders" />
    </section>
  );
}
