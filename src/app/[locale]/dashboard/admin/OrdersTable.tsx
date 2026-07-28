"use client";

import {
  TablePager,
  TableToolbar,
  useTableView,
  type FilterDef,
  type SortDef,
} from "@/components/dashboard/table-view";

export type OrderRow = {
  id: string;
  email: string;
  tier: string;
  amount: number;
  currency: string;
  paygateId: string | null;
  status: string;
  createdAt: string;
};

const FILTERS: FilterDef<OrderRow>[] = [
  { key: "success", label: "Paid", test: (r) => r.status === "SUCCESS" },
  { key: "pending", label: "Pending", test: (r) => r.status === "PENDING" },
  { key: "failed", label: "Failed", test: (r) => r.status !== "SUCCESS" && r.status !== "PENDING" },
];

const SORTS: SortDef<OrderRow>[] = [
  { key: "newest", label: "Newest first", compare: (a, b) => b.createdAt.localeCompare(a.createdAt) },
  { key: "oldest", label: "Oldest first", compare: (a, b) => a.createdAt.localeCompare(b.createdAt) },
  { key: "amount", label: "Largest amount", compare: (a, b) => b.amount - a.amount },
  { key: "email", label: "Email A–Z", compare: (a, b) => a.email.localeCompare(b.email) },
];

function tone(status: string) {
  if (status === "SUCCESS") return "live";
  if (status === "PENDING") return "soon";
  return "bad";
}

export default function OrdersTable({ orders }: { orders: OrderRow[] }) {
  const view = useTableView(orders, {
    // Paygate references are searchable: chasing a payment starts from the
    // reference the customer or the gateway quotes, not their email.
    search: (row, q) =>
      row.email.toLowerCase().includes(q) ||
      (row.paygateId ?? "").toLowerCase().includes(q),
    filters: FILTERS,
    sorts: SORTS,
    pageSize: 10,
  });

  const paid = orders
    .filter((o) => o.status === "SUCCESS")
    .reduce((sum, o) => sum + o.amount, 0);

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
        searchPlaceholder="Search email or payment reference…"
      />

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
                  {orders.length === 0 ? "No orders yet." : "No orders match those filters."}
                </td>
              </tr>
            )}
            {view.pageRows.map((row) => (
              <tr key={row.id}>
                <td data-label="Customer">
                  <span className="cell-stack">
                    <span className="robot-name">{row.email}</span>
                    <span className="robot-slug">{row.paygateId ?? "no reference"}</span>
                  </span>
                </td>
                <td data-label="Tier" style={{ whiteSpace: "nowrap" }}>
                  {row.tier.replace(/_/g, " ")}
                </td>
                <td data-label="Amount" style={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                  ${row.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {row.currency}
                </td>
                <td data-label="Status">
                  <span className="pill" data-tone={tone(row.status)}>
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
