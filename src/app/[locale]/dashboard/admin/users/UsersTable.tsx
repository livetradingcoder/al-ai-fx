"use client";

import { useState } from "react";
import { toggleBlockUser, deleteUser } from "./actions";
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
}

interface UserData {
  id: string;
  email: string;
  role: string;
  isBlocked: boolean;
  isDeleted: boolean;
  createdAt: Date;
  subscriptions: Subscription[];
}

type Notice = { kind: "ok" | "error"; text: string };

const activeCount = (u: UserData) =>
  u.isDeleted ? 0 : u.subscriptions.filter((s) => s.status === "ACTIVE").length;

const FILTERS: FilterDef<UserData>[] = [
  { key: "customers", label: "With a licence", test: (u) => activeCount(u) > 0 },
  { key: "none", label: "No licence", test: (u) => activeCount(u) === 0 && !u.isDeleted },
  { key: "admins", label: "Admins", test: (u) => u.role === "ADMIN" },
  { key: "blocked", label: "Blocked", test: (u) => u.isBlocked && !u.isDeleted },
  { key: "deleted", label: "Deleted", test: (u) => u.isDeleted },
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
}: {
  users: UserData[];
  currentUserId: string;
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const view = useTableView(users, {
    // MT5 numbers are searchable too: support tickets quote the account, not
    // the email, so that is what an admin has in hand.
    search: (user, q) =>
      user.email.toLowerCase().includes(q) ||
      user.subscriptions.some((s) => (s.mt5AccountNumber ?? "").includes(q)),
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
      await toggleBlockUser(user.id, user.isBlocked);
      setNotice({
        kind: "ok",
        text: user.isBlocked ? `${user.email} can sign in again.` : `${user.email} is blocked.`,
      });
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
    if (
      !confirm(
        `Permanently delete ${user.email}? Their orders and subscriptions are removed too.`,
      )
    ) {
      return;
    }
    setLoadingId(user.id);
    setNotice(null);
    try {
      await deleteUser(user.id);
      setNotice({ kind: "ok", text: `${user.email} deleted.` });
    } catch (error) {
      fail(error, "Failed to delete user");
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
      </div>

      {notice && (
        <p className={`admin-notice is-${notice.kind}`} role="status">
          {notice.text}
        </p>
      )}

      <TableToolbar
        view={view}
        filters={FILTERS}
        sorts={SORTS}
        searchPlaceholder="Search email or MT5 account…"
      />

      <div className="table-wrap">
        <table className="data-table is-wide">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Active licences</th>
              <th>Joined</th>
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
                      <span className="robot-name">{user.email}</span>
                      {mt5 && <span className="robot-slug">MT5 {mt5}</span>}
                    </span>
                  </td>

                  <td data-label="Role">{user.role}</td>

                  <td data-label="Active licences">{activeCount(user)}</td>

                  <td data-label="Joined">{new Date(user.createdAt).toLocaleDateString()}</td>

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
