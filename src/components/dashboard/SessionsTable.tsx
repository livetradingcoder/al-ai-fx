"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type SessionRow = {
  id: string;
  device: string;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
};

/** Signing out a device revokes its token on the next request. */
export default function SessionsTable({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function revoke(payload: { id?: string; all?: boolean }, key: string) {
    setBusy(key);
    setError("");
    try {
      const res = await fetch("/api/account/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not sign that device out");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign that device out");
    } finally {
      setBusy(null);
    }
  }

  if (sessions.length === 0) {
    return (
      <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
        No other devices are signed in.
      </p>
    );
  }

  return (
    <>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Device</th>
              <th>IP</th>
              <th>Signed in</th>
              <th>Last used</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td data-label="Device">{s.device}</td>
                <td data-label="IP" className="num">{s.ip || "—"}</td>
                <td data-label="Signed in" className="num">{s.createdAt}</td>
                <td data-label="Last used" className="num">{s.lastSeenAt}</td>
                <td data-label="Action">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busy === s.id}
                    onClick={() => revoke({ id: s.id }, s.id)}
                  >
                    {busy === s.id ? "Signing out…" : "Sign out"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        className="btn-secondary"
        style={{ marginTop: "16px" }}
        disabled={busy === "all"}
        onClick={() => revoke({ all: true }, "all")}
      >
        {busy === "all" ? "Signing out…" : "Sign out of every device"}
      </button>
      <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "8px" }}>
        This signs out this browser too — you&apos;ll need to sign in again.
      </p>

      {error && (
        <p style={{ marginTop: "12px", fontSize: "0.86rem", color: "var(--accent-danger)" }}>
          {error}
        </p>
      )}
    </>
  );
}
