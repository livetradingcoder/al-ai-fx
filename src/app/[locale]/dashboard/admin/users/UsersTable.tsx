"use client";

import { useState } from "react";
import { toggleBlockUser, deleteUser, setUserRole } from "./actions";
import AddUserForm from "./AddUserForm";
import Dialog from "@/components/dashboard/Dialog";
import type { UserLocation } from "@/lib/admin-locations";
import {
  TablePager,
  TableToolbar,
  useTableView,
  type FilterDef,
  type SortDef,
} from "@/components/dashboard/table-view";

interface Subscription {
  id: string;
  tier: string;
  status: string;
  mt5AccountNumber: string | null;
  expiresAt: Date | null;
}

interface UserData {
  id: string;
  email: string;
  role: string;
  isBlocked: boolean;
  isDeleted: boolean;
  createdAt: Date;
  subscriptions: Subscription[];
  location: UserLocation | null;
}

type Notice = { kind: "ok" | "error"; text: string };

const activeCount = (u: UserData) =>
  u.isDeleted ? 0 : u.subscriptions.filter((s) => s.status === "ACTIVE").length;

const PAID_TIERS = ["TEN_DAYS", "ONE_MONTH", "SIX_MONTHS", "ONE_YEAR", "LIFETIME", "LIFETIME_SOURCE"];
const hasTrial = (u: UserData) => !u.isDeleted && u.subscriptions.some((s) => s.tier === "FREE_TRIAL");
const isLinked = (u: UserData) =>
  u.subscriptions.some((s) => !!s.mt5AccountNumber?.trim() && !PAID_TIERS.includes(s.tier));
const trialEnded = (u: UserData) => {
  const ends = u.subscriptions
    .filter((s) => s.tier === "FREE_TRIAL" && s.expiresAt)
    .map((s) => +new Date(s.expiresAt as Date));
  return ends.length > 0 && Math.max(...ends) <= Date.now();
};

const FILTERS: FilterDef<UserData>[] = [
  { key: "trial-linked", label: "Trial: MT5 linked", test: (u) => hasTrial(u) && isLinked(u) },
  { key: "trial-not-linked", label: "Trial: MT5 not linked", test: (u) => hasTrial(u) && !isLinked(u) },
  { key: "trial-running", label: "Trial running", test: (u) => hasTrial(u) && !trialEnded(u) },
  { key: "trial-ended", label: "Trial ended", test: (u) => hasTrial(u) && trialEnded(u) },
  { key: "customers", label: "With a licence", test: (u) => activeCount(u) > 0 },
  { key: "none", label: "No licence", test: (u) => activeCount(u) === 0 && !u.isDeleted },
  { key: "admins", label: "Admins", test: (u) => u.role === "ADMIN" },
  { key: "blocked", label: "Blocked", test: (u) => u.isBlocked && !u.isDeleted },
  { key: "deleted", label: "Deleted", test: (u) => u.isDeleted },
  { key: "shared-ip", label: "Shares an IP", test: (u) => (u.location?.sharedWith ?? 0) > 0 },
];

const SORTS: SortDef<UserData>[] = [
  { key: "newest", label: "Newest first", compare: (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt) },
  { key: "oldest", label: "Oldest first", compare: (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt) },
  { key: "licences", label: "Most licences", compare: (a, b) => activeCount(b) - activeCount(a) },
  { key: "email", label: "Email A–Z", compare: (a, b) => a.email.localeCompare(b.email) },
];

export default function UsersTable({
  users,
  currentUserId,
  defaultAdding = false,
}: {
  users: UserData[];
  currentUserId: string;
  /** Open the "Add a person" dialog on arrival (the admin home links here). */
  defaultAdding?: boolean;
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [adding, setAdding] = useState(defaultAdding);

  function closeAdding() {
    setAdding(false);
    // The link that opened it carried ?add=1; drop that so a refresh doesn't
    // open it again.
    if (window.location.search.includes("add=1")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }

  const view = useTableView(users, {
    // MT5 numbers are searchable too: support tickets quote the account, not
    // the email, so that is what an admin has in hand.
    search: (user, q) =>
      user.email.toLowerCase().includes(q) ||
      user.subscriptions.some((s) => (s.mt5AccountNumber ?? "").includes(q)) ||
      (user.location?.ip ?? "").includes(q) ||
      (user.location?.country ?? "").toLowerCase() === q ||
      (user.location?.countryName ?? "").toLowerCase().includes(q),
    filters: FILTERS,
    sorts: SORTS,
    pageSize: 25,
  });

  const fail = (error: unknown, fallback: string) =>
    setNotice({ kind: "error", text: error instanceof Error ? error.message : fallback });

  async function handleToggleBlock(user: UserData) {
    if (user.id === currentUserId) {
      return setNotice({ kind: "error", text: "You cannot block yourself." });
    }
    setLoadingId(user.id);
    setNotice(null);
    try {
      const res = await toggleBlockUser(user.id, user.isBlocked);
      setNotice(res.ok ? { kind: "ok", text: res.message } : { kind: "error", text: res.error });
    } catch (error) {
      fail(error, "Failed to update block status");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDelete(user: UserData) {
    if (user.id === currentUserId) {
      return setNotice({ kind: "error", text: "You cannot delete yourself." });
    }
    // Soft delete: the account can no longer sign in, but its orders and
    // licences stay on record.
    if (!confirm(`Delete ${user.email}? They won't be able to sign in. Orders and licences stay on record.`)) {
      return;
    }
    setLoadingId(user.id);
    setNotice(null);
    try {
      const res = await deleteUser(user.id);
      setNotice(res.ok ? { kind: "ok", text: res.message } : { kind: "error", text: res.error });
    } catch (error) {
      fail(error, "Failed to delete user");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleRole(user: UserData) {
    const makeAdmin = user.role !== "ADMIN";
    const question = makeAdmin
      ? `Make ${user.email} an admin? They will see every customer, order and licence, and can create free coupons.`
      : `Remove admin access from ${user.email}? They keep their account and licences.`;
    if (!confirm(question)) return;

    setLoadingId(user.id);
    setNotice(null);
    try {
      const res = await setUserRole(user.id, makeAdmin ? "ADMIN" : "USER");
      setNotice(res.ok ? { kind: "ok", text: res.message } : { kind: "error", text: res.error });
    } catch (error) {
      fail(error, "Failed to change role");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <section className="card">
      <div className="admin-table-head">
        <div>
          <p className="card-label">People</p>
          <h2 style={{ fontSize: "1.15rem", margin: 0 }}>Platform users</h2>
        </div>
        <button type="button" className="btn-primary btn-sm" onClick={() => setAdding(true)}>
          Add a person
        </button>
      </div>

      <Dialog open={adding} onClose={closeAdding} eyebrow="Access" title="Add a person">
        <AddUserForm
          onDone={(message) => {
            closeAdding();
            setNotice({ kind: "ok", text: message });
          }}
        />
      </Dialog>

      {notice && (
        <p className={`admin-notice is-${notice.kind}`} role="status">
          {notice.text}
        </p>
      )}

      <TableToolbar
        view={view}
        filters={FILTERS}
        sorts={SORTS}
        searchPlaceholder="Search email, MT5 account, IP or country…"
      />

      <div className="table-wrap">
        <table className="data-table is-wide is-tight">
          <thead>
            <tr>
              <th>User</th>
              <th title="Active licences">Licences</th>
              <th>Joined</th>
              <th>Location</th>
              <th>Access</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {view.pageRows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                  {users.length === 0 ? "No users yet." : "No users match those filters."}
                </td>
              </tr>
            )}
            {view.pageRows.map((user) => {
              const isLoading = loadingId === user.id;
              const isSelf = user.id === currentUserId;
              const mt5 = user.subscriptions.find((s) => s.mt5AccountNumber)?.mt5AccountNumber;

              return (
                <tr key={user.id} data-dim={user.isDeleted ? "true" : undefined}>
                  <td data-label="User">
                    <span className="cell-stack">
                      <span className="robot-name cell-clip clip-lg" title={user.email}>
                        {user.email}
                      </span>
                      <span className="cell-line">
                        {user.role === "ADMIN" && (
                          <span className="pill is-small" data-tone="soon">
                            Admin
                          </span>
                        )}
                        <span className="robot-slug cell-clip clip-lg" style={{ marginTop: 0 }}>
                          {mt5 ? `MT5 ${mt5}` : "No MT5 account"}
                        </span>
                      </span>
                    </span>
                  </td>

                  <td data-label="Licences">{activeCount(user)}</td>

                  <td data-label="Joined">{new Date(user.createdAt).toLocaleDateString()}</td>

                  <td data-label="Location">
                    {user.location ? (
                      <span className="cell-stack">
                        <span className="cell-line">
                          <span className="robot-name cell-clip clip-sm" title={user.location.countryName ?? "Unknown country"}>
                            {user.location.countryShort ?? "Unknown"}
                          </span>
                          {user.location.sharedWith > 0 && (
                            <span
                              className="pill is-small"
                              data-tone="soon"
                              title={`${user.location.sharedWith} other ${user.location.sharedWith === 1 ? "account has" : "accounts have"} used the same IP address`}
                            >
                              Shared · {user.location.sharedWith}
                            </span>
                          )}
                        </span>
                        <span
                          className="robot-slug cell-clip clip-sm"
                          title={
                            user.location.addresses > 1
                              ? `${user.location.ip} (latest of ${user.location.addresses} addresses)`
                              : user.location.ip
                          }
                        >
                          {user.location.ip}
                          {user.location.addresses > 1 ? ` +${user.location.addresses - 1}` : ""}
                        </span>
                      </span>
                    ) : (
                      <span className="cell-muted">—</span>
                    )}
                  </td>

                  <td data-label="Access">
                    <span
                      className="pill"
                      data-tone={user.isDeleted ? "off" : user.isBlocked ? "bad" : "live"}
                    >
                      {user.isDeleted ? "Deleted" : user.isBlocked ? "Blocked" : "Active"}
                    </span>
                  </td>

                  <td data-label="Actions" className="cell-actions">
                    <div className="row-actions">
                      {isSelf || user.isDeleted ? (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                          {isSelf ? "That's you" : "—"}
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn-mini"
                            onClick={() => handleRole(user)}
                            disabled={isLoading}
                          >
                            {user.role === "ADMIN" ? "Remove admin" : "Make admin"}
                          </button>
                          <button
                            type="button"
                            className={`btn-mini ${user.isBlocked ? "is-go" : ""}`}
                            onClick={() => handleToggleBlock(user)}
                            disabled={isLoading}
                          >
                            {user.isBlocked ? "Unblock" : "Block"}
                          </button>
                          <button
                            type="button"
                            className="btn-mini is-danger"
                            onClick={() => handleDelete(user)}
                            disabled={isLoading}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <TablePager view={view} noun="users" />
    </section>
  );
}
