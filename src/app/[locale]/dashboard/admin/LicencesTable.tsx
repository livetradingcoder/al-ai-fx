"use client";

import {
  TablePager,
  TableToolbar,
  useTableView,
  type FilterDef,
  type SortDef,
} from "@/components/dashboard/table-view";

export type LicenceRow = {
  id: string;
  email: string;
  mt5AccountNumber: string | null;
  robot: string;
  tier: string;
  status: string;
  createdAt: string;
};

const FILTERS: FilterDef<LicenceRow>[] = [
  { key: "active", label: "Active", test: (r) => r.status === "ACTIVE" },
  { key: "trial", label: "Free trials", test: (r) => r.tier === "FREE_TRIAL" },
  { key: "paid", label: "Paid", test: (r) => r.tier !== "FREE_TRIAL" },
  { key: "unlinked", label: "No MT5 account yet", test: (r) => !r.mt5AccountNumber },
];

const SORTS: SortDef<LicenceRow>[] = [
  { key: "newest", label: "Newest first", compare: (a, b) => b.createdAt.localeCompare(a.createdAt) },
  { key: "oldest", label: "Oldest first", compare: (a, b) => a.createdAt.localeCompare(b.createdAt) },
  { key: "email", label: "Email A–Z", compare: (a, b) => a.email.localeCompare(b.email) },
  { key: "robot", label: "By robot", compare: (a, b) => a.robot.localeCompare(b.robot) },
];

export default function LicencesTable({ licences }: { licences: LicenceRow[] }) {
  const view = useTableView(licences, {
    search: (row, q) =>
      row.email.toLowerCase().includes(q) ||
      (row.mt5AccountNumber ?? "").includes(q) ||
      row.robot.toLowerCase().includes(q),
    filters: FILTERS,
    sorts: SORTS,
    pageSize: 10,
  });

  return (
    <section className="card" style={{ marginBottom: "20px" }}>
      <div className="admin-table-head">
        <div>
          <p className="card-label">Licences</p>
          <h2 style={{ fontSize: "1.15rem", margin: 0 }}>Issued licences</h2>
        </div>
      </div>

      <TableToolbar
        view={view}
        filters={FILTERS}
        sorts={SORTS}
        searchPlaceholder="Search email, MT5 account or robot…"
      />

      <div className="table-wrap">
        <table className="data-table is-wide">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Robot</th>
              <th>Tier</th>
              <th>Status</th>
              <th>Issued</th>
            </tr>
          </thead>
          <tbody>
            {view.pageRows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                  {licences.length === 0 ? "No licences yet." : "No licences match those filters."}
                </td>
              </tr>
            )}
            {view.pageRows.map((row) => (
              <tr key={row.id}>
                <td data-label="Customer">
                  <span className="cell-stack">
                    <span className="robot-name">{row.email}</span>
                    <span className="robot-slug">
                      {row.mt5AccountNumber ? `MT5 ${row.mt5AccountNumber}` : "MT5 not linked"}
                    </span>
                  </span>
                </td>
                <td data-label="Robot">{row.robot}</td>
                <td data-label="Tier" style={{ whiteSpace: "nowrap" }}>
                  {row.tier.replace(/_/g, " ")}
                </td>
                <td data-label="Status">
                  <span className="pill" data-tone={row.status === "ACTIVE" ? "live" : "off"}>
                    {row.status}
                  </span>
                </td>
                <td data-label="Issued" style={{ whiteSpace: "nowrap" }}>
                  {new Date(row.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TablePager view={view} noun="licences" />
    </section>
  );
}
