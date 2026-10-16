"use client";

import { useState, useTransition } from "react";

import {
  TablePager,
  TableToolbar,
  useTableView,
  type FilterDef,
  type SortDef,
} from "@/components/dashboard/table-view";
import type { ActionResult } from "@/lib/action-result";
import { reviewResultProof, reviewShareProof, setProofPublished } from "./actions";
import { formatDate, formatDateTime } from "@/lib/format-date";

type Status = "PENDING" | "APPROVED" | "REJECTED";

export type ResultRow = {
  id: string;
  email: string;
  displayName: string | null;
  publishConsent: boolean;
  status: Status;
  adminNote: string | null;
  published: boolean;
  createdAt: string;
};

export type ShareRow = {
  id: string;
  email: string;
  platform: string;
  url: string;
  status: Status;
  adminNote: string | null;
  code: string | null;
  used: boolean;
  createdAt: string;
};

type Notice = { kind: "ok" | "error"; text: string } | null;

const TONE: Record<Status, "live" | "soon" | "bad"> = { PENDING: "soon", APPROVED: "live", REJECTED: "bad" };

// Pending first, then newest: the queue is the point of this page.
const rank = (s: Status) => (s === "PENDING" ? 0 : 1);

const RESULT_FILTERS: FilterDef<ResultRow>[] = [
  { key: "pending", label: "Waiting for review", test: (r) => r.status === "PENDING" },
  { key: "approved", label: "Approved", test: (r) => r.status === "APPROVED" },
  { key: "published", label: "On the results page", test: (r) => r.published },
  { key: "rejected", label: "Rejected", test: (r) => r.status === "REJECTED" },
];
const RESULT_SORTS: SortDef<ResultRow>[] = [
  { key: "queue", label: "Pending first", compare: (a, b) => rank(a.status) - rank(b.status) || b.createdAt.localeCompare(a.createdAt) },
  { key: "newest", label: "Newest first", compare: (a, b) => b.createdAt.localeCompare(a.createdAt) },
];

const SHARE_FILTERS: FilterDef<ShareRow>[] = [
  { key: "pending", label: "Waiting for review", test: (s) => s.status === "PENDING" },
  { key: "approved", label: "Approved", test: (s) => s.status === "APPROVED" },
  { key: "unused", label: "Code not used yet", test: (s) => s.status === "APPROVED" && !s.used },
  { key: "rejected", label: "Rejected", test: (s) => s.status === "REJECTED" },
];
const SHARE_SORTS: SortDef<ShareRow>[] = [
  { key: "queue", label: "Pending first", compare: (a, b) => rank(a.status) - rank(b.status) || b.createdAt.localeCompare(a.createdAt) },
  { key: "newest", label: "Newest first", compare: (a, b) => b.createdAt.localeCompare(a.createdAt) },
];

export default function ProofsAdmin({ results, shares }: { results: ResultRow[]; shares: ShareRow[] }) {
  const [tab, setTab] = useState<"results" | "shares">("results");
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, start] = useTransition();

  const resultView = useTableView(results, {
    search: (r, q) => r.email.toLowerCase().includes(q) || (r.displayName ?? "").toLowerCase().includes(q),
    filters: RESULT_FILTERS,
    sorts: RESULT_SORTS,
    pageSize: 25,
  });
  const shareView = useTableView(shares, {
    search: (s, q) => s.email.toLowerCase().includes(q) || s.platform.toLowerCase().includes(q) || (s.code ?? "").toLowerCase().includes(q),
    filters: SHARE_FILTERS,
    sorts: SHARE_SORTS,
    pageSize: 25,
  });

  const waitingResults = results.filter((r) => r.status === "PENDING").length;
  const waitingShares = shares.filter((s) => s.status === "PENDING").length;

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

  // A short reason is optional; cancelling the prompt cancels the rejection.
  function reject(kind: "result" | "share", id: string) {
    const note = window.prompt("Reason (optional, only you see it):", "");
    if (note === null) return;
    run(() =>
      kind === "result"
        ? reviewResultProof({ id, decision: "reject", note })
        : reviewShareProof({ id, decision: "reject", note }),
    );
  }

  return (
    <section className="card">
      <div className="admin-table-head">
        <div>
          <p className="card-label">Review queue</p>
          <h2 style={{ fontSize: "1.15rem", margin: 0 }}>
            {tab === "results" ? "Results screenshots" : "Shared posts"}
          </h2>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            className={tab === "results" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
            onClick={() => setTab("results")}
          >
            Screenshots{waitingResults > 0 ? ` (${waitingResults})` : ""}
          </button>
          <button
            type="button"
            className={tab === "shares" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
            onClick={() => setTab("shares")}
          >
            Shared posts{waitingShares > 0 ? ` (${waitingShares})` : ""}
          </button>
        </div>
      </div>

      {notice && <p className={`admin-notice is-${notice.kind}`}>{notice.text}</p>}

      {tab === "results" ? (
        <>
          <TableToolbar view={resultView} filters={RESULT_FILTERS} sorts={RESULT_SORTS} searchPlaceholder="Search email or name…" />
          <div className="table-wrap">
            <table className="data-table is-wide">
              <thead>
                <tr>
                  <th>Screenshot</th>
                  <th>Person</th>
                  <th>Public display</th>
                  <th>State</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {resultView.pageRows.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                      {results.length === 0 ? "No screenshots yet." : "Nothing matches those filters."}
                    </td>
                  </tr>
                )}
                {resultView.pageRows.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Screenshot">
                      <a href={`/api/proofs/${r.id}/image`} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/proofs/${r.id}/image`}
                          alt="Results screenshot"
                          loading="lazy"
                          style={{ width: "120px", height: "80px", objectFit: "cover", borderRadius: "8px", border: "1px solid var(--border-color)" }}
                        />
                      </a>
                    </td>
                    <td data-label="Person">
                      <span className="cell-stack">
                        <span>{r.email}</span>
                        <span className="cell-note">
                          {r.displayName ? `Shown as “${r.displayName}”` : "No name given"} · {formatDateTime(r.createdAt)}
                        </span>
                      </span>
                    </td>
                    <td data-label="Public display">
                      {r.publishConsent ? "Agreed" : "Did not agree"}
                      {r.published && <span className="cell-note"> · live</span>}
                    </td>
                    <td data-label="State">
                      <span className="pill" data-tone={TONE[r.status]}>{r.status.toLowerCase()}</span>
                      {r.adminNote && <span className="cell-note" style={{ display: "block" }}>{r.adminNote}</span>}
                    </td>
                    <td data-label="Actions" style={{ textAlign: "right" }}>
                      <span style={{ display: "inline-flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {r.status === "PENDING" && (
                          <>
                            <button type="button" className="btn-mini is-go" disabled={pending} onClick={() => run(() => reviewResultProof({ id: r.id, decision: "approve" }))}>
                              Approve
                            </button>
                            <button type="button" className="btn-mini is-danger" disabled={pending} onClick={() => reject("result", r.id)}>
                              Reject
                            </button>
                          </>
                        )}
                        {r.status === "APPROVED" && r.publishConsent && (
                          <button type="button" className="btn-mini" disabled={pending} onClick={() => run(() => setProofPublished({ id: r.id, published: !r.published }))}>
                            {r.published ? "Unpublish" : "Publish"}
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePager view={resultView} noun="screenshots" />
        </>
      ) : (
        <>
          <TableToolbar view={shareView} filters={SHARE_FILTERS} sorts={SHARE_SORTS} searchPlaceholder="Search email, network or code…" />
          <div className="table-wrap">
            <table className="data-table is-wide">
              <thead>
                <tr>
                  <th>Post</th>
                  <th>Person</th>
                  <th>Reward code</th>
                  <th>State</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shareView.pageRows.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                      {shares.length === 0 ? "No shared posts yet." : "Nothing matches those filters."}
                    </td>
                  </tr>
                )}
                {shareView.pageRows.map((s) => (
                  <tr key={s.id}>
                    <td data-label="Post">
                      <span className="cell-stack">
                        <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">
                          Open on {s.platform}
                        </a>
                        <span className="cell-note" style={{ wordBreak: "break-all" }}>{s.url}</span>
                      </span>
                    </td>
                    <td data-label="Person">
                      <span className="cell-stack">
                        <span>{s.email}</span>
                        <span className="cell-note">{formatDateTime(s.createdAt)}</span>
                      </span>
                    </td>
                    <td data-label="Reward code">
                      {s.code ? (
                        <>
                          <code>{s.code}</code>
                          <span className="cell-note"> · {s.used ? "used" : "not used yet"}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td data-label="State">
                      <span className="pill" data-tone={TONE[s.status]}>{s.status.toLowerCase()}</span>
                      {s.adminNote && <span className="cell-note" style={{ display: "block" }}>{s.adminNote}</span>}
                    </td>
                    <td data-label="Actions" style={{ textAlign: "right" }}>
                      {s.status === "PENDING" && (
                        <span style={{ display: "inline-flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                          <button type="button" className="btn-mini is-go" disabled={pending} onClick={() => run(() => reviewShareProof({ id: s.id, decision: "approve" }))}>
                            Approve &amp; send code
                          </button>
                          <button type="button" className="btn-mini is-danger" disabled={pending} onClick={() => reject("share", s.id)}>
                            Reject
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePager view={shareView} noun="posts" />
        </>
      )}
    </section>
  );
}
