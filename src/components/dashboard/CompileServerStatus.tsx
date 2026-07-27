"use client";

import { useEffect, useRef, useState } from "react";

type StatusResponse = {
  status: "green" | "stale" | "red";
  lastSeenAgoSeconds: number | null;
  oldestPendingAgeSeconds: number | null;
  processingCount: number;
  stuckCount: number;
  failedLast24h: number;
  thresholds: {
    heartbeatStaleSeconds: number;
    heartbeatDeadSeconds: number;
    stuckJobMinutes: number;
  };
};

const COLORS = {
  green: "var(--accent-accent)",
  stale: "#f4dca2",
  red: "#ff4444",
} as const;

const LABELS = {
  green: "Online",
  stale: "Stale",
  red: "Offline",
} as const;

/**
 * Client tile shown on /dashboard/admin. Polls /api/admin/compiler-status
 * every 15s. The card itself stays the same shape as its neighbours — label
 * and one value — and the queue counters live in a popover, on hover for
 * mice and on tap for everything else.
 */
export default function CompileServerStatus() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const res = await fetch("/api/admin/compiler-status");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as StatusResponse;
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }

    fetchStatus();
    const iv = setInterval(fetchStatus, 15_000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  // Tap-outside and Esc close it; hover-only would strand touch users.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | TouchEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (error) {
    return (
      <div className="card">
        <p className="card-label">Compile worker</p>
        <p className="card-value" style={{ color: "#ff4444", fontSize: "1.1rem" }}>
          Status error
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "6px" }}>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card">
        <p className="card-label">Compile worker</p>
        <p className="card-value" style={{ color: "var(--text-muted)" }}>
          Loading…
        </p>
      </div>
    );
  }

  const color = COLORS[data.status];
  const rows: [string, string][] = [
    [
      "Last heartbeat",
      data.lastSeenAgoSeconds === null ? "never" : `${data.lastSeenAgoSeconds}s ago`,
    ],
    ["In progress", String(data.processingCount)],
    [`Stuck (> ${data.thresholds.stuckJobMinutes}m)`, String(data.stuckCount)],
    ["Failed (24h)", String(data.failedLast24h)],
  ];
  if (data.oldestPendingAgeSeconds !== null) {
    rows.push([
      "Oldest pending",
      `${Math.floor(data.oldestPendingAgeSeconds / 60)}m ${data.oldestPendingAgeSeconds % 60}s`,
    ]);
  }

  return (
    <div className="card stat-pop-wrap" ref={wrapRef}>
      <p className="card-label">Compile worker</p>
      <p className="card-value" style={{ color, display: "flex", alignItems: "center", gap: "10px" }}>
        <span
          aria-hidden
          style={{
            width: 11,
            height: 11,
            flex: "none",
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 12px ${color}`,
          }}
        />
        {LABELS[data.status]}
      </p>

      <button
        type="button"
        className="stat-pop-trigger"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Queue details
      </button>

      {open && <div className="stat-pop-backdrop" onClick={() => setOpen(false)} role="presentation" />}

      <div className="stat-pop" data-open={open ? "true" : undefined} role="group" aria-label="Queue details">
        <p className="card-label" style={{ marginBottom: "10px" }}>
          Queue
        </p>
        <dl className="stat-pop-list">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
