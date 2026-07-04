"use client";

import { useEffect, useState } from "react";

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
  stale: "Stale (no recent heartbeat)",
  red: "Offline",
} as const;

/**
 * Client tile shown on /dashboard/admin. Polls /api/admin/compiler-status
 * every 15s and renders a color-coded status dot plus queue-health counters.
 * Cleans up its interval on unmount.
 */
export default function CompileServerStatus() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (error) {
    return (
      <div className="feature-card">
        <h3 style={{ color: "var(--text-secondary)", fontSize: "1rem" }}>Compile Server</h3>
        <div style={{ marginTop: "0.5rem", color: "#ff4444", fontSize: "0.9rem" }}>
          Status error: {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="feature-card">
        <h3 style={{ color: "var(--text-secondary)", fontSize: "1rem" }}>Compile Server</h3>
        <div style={{ marginTop: "0.5rem", color: "var(--text-muted)" }}>Loading…</div>
      </div>
    );
  }

  const color = COLORS[data.status];
  const label = LABELS[data.status];

  return (
    <div className="feature-card">
      <h3 style={{ color: "var(--text-secondary)", fontSize: "1rem" }}>Compile Server</h3>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          marginTop: "0.75rem",
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 12px ${color}`,
          }}
        />
        <span
          style={{
            fontFamily: "Outfit",
            fontSize: "1.4rem",
            fontWeight: "bold",
            color,
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          marginTop: "0.75rem",
          fontSize: "0.85rem",
          color: "var(--text-secondary)",
          lineHeight: 1.7,
        }}
      >
        <div>
          Last heartbeat: {data.lastSeenAgoSeconds === null ? "never" : `${data.lastSeenAgoSeconds}s ago`}
        </div>
        <div>In progress: {data.processingCount}</div>
        <div>
          Stuck (&gt; {data.thresholds.stuckJobMinutes}m): {data.stuckCount}
        </div>
        <div>Failed (24h): {data.failedLast24h}</div>
        {data.oldestPendingAgeSeconds !== null && (
          <div>
            Oldest pending: {Math.floor(data.oldestPendingAgeSeconds / 60)}m{" "}
            {data.oldestPendingAgeSeconds % 60}s
          </div>
        )}
      </div>
    </div>
  );
}
