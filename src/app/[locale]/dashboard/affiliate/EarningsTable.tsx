"use client";

import {
  TablePager,
  TableToolbar,
  useTableView,
  type FilterDef,
  type SortDef,
} from "@/components/dashboard/table-view";

export type EarningRow = {
  id: string;
  customer: string; // already masked server-side
  robot: string;
  tier: string;
  orderAmount: number;
  rate: number;
  amount: number;
  status: string;
  holdUntil: string;
  createdAt: string;
};

const FILTERS: FilterDef<EarningRow>[] = [
  { key: "pending", label: "On hold", test: (r) => r.status === "PENDING" },
  { key: "approved", label: "Ready to pay", test: (r) => r.status === "APPROVED" },
  { key: "paid", label: "Paid", test: (r) => r.status === "PAID" },
  { key: "reversed", label: "Reversed", test: (r) => r.status === "REVERSED" },
];

const SORTS: SortDef<EarningRow>[] = [
  { key: "newest", label: "Newest first", compare: (a, b) => b.createdAt.localeCompare(a.createdAt) },
  { key: "amount", label: "Biggest first", compare: (a, b) => b.amount - a.amount },
  { key: "oldest", label: "Oldest first", compare: (a, b) => a.createdAt.localeCompare(b.createdAt) },
];

function tone(status: string) {
  if (status === "PAID" || status === "APPROVED") return "live";
  if (status === "PENDING") return "soon";
  return "bad";
}

const LABEL: Record<string, string> = {
  PENDING: "On hold",
  APPROVED: "Ready",
  PAID: "Paid",
  REVERSED: "Reversed",
};

export default function EarningsTable({ rows }: { rows: EarningRow[] }) {
  const view = useTableView(rows, {
    search: (row, q) =>
      row.customer.toLowerCase().includes(q) || row.robot.toLowerCase().includes(q),
    filters: FILTERS,
    sorts: SORTS,
    pageSize: 10,
  });

  return (
    <section className="card">
      <div className="admin-table-head">
        <div>
          <p className="card-label">Earnings</p>
          <h2 style={{ fontSize: "1.15rem", margin: 0 }}>Every sale you referred</h2>
        </div>
      </div>

      <TableToolbar view={view} filters={FILTERS} sorts={SORTS} searchPlaceholder="Search customer or robot…" />

      <div className="table-wrap">
        <table className="data-table is-wide">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Bought</th>
              <th>Order</th>
              <th>Your cut</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {view.pageRows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                  {rows.length === 0
                    ? "No sales yet — share your link to get started."
                    : "Nothing matches those filters."}
                </td>
              </tr>
            )}
            {view.pageRows.map((row) => (
              <tr key={row.id}>
                <td data-label="Customer">{row.customer}</td>
                <td data-label="Bought">
                  <span className="cell-stack">
                    <span>{row.robot}</span>
                    <span className="cell-note">{row.tier.replace(/_/g, " ").toLowerCase()}</span>
                  </span>
                </td>
                <td data-label="Order">${row.orderAmount.toFixed(2)}</td>
                <td data-label="Your cut">
                  <span className="cell-stack">
                    <span style={{ fontWeight: 600 }}>${row.amount.toFixed(2)}</span>
                    <span className="cell-note">{row.rate}%</span>
                  </span>
                </td>
                <td data-label="Status">
                  <span className="pill" data-tone={tone(row.status)}>
                    {LABEL[row.status] ?? row.status}
                  </span>
                  {row.status === "PENDING" && (
                    <span className="cell-note">
                      clears {new Date(row.holdUntil).toLocaleDateString()}
                    </span>
                  )}
                </td>
                <td data-label="Date">{new Date(row.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TablePager view={view} noun="sales" />
    </section>
  );
}
