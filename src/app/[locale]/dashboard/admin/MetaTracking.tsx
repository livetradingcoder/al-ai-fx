"use client";

import { useState, useTransition } from "react";

import { sendMetaTestEvent } from "./meta-actions";

export type MetaTrackingView = {
  pixelId: string;
  tokenSet: boolean;
  testMode: boolean;
  version: string;
  table: "ok" | "missing" | "error";
  recent: { when: string; events: string; ok: boolean; test: boolean; detail: string }[];
};

function Row({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" | "warn" }) {
  const color = tone === "ok" ? "#9cd7b4" : tone === "bad" ? "#efa094" : tone === "warn" ? "var(--accent-primary-light)" : undefined;
  return (
    <div className="meta-row">
      <span>{label}</span>
      <strong style={color ? { color } : undefined}>{value}</strong>
    </div>
  );
}

/** Whether Meta tracking is wired, and a button that proves it end to end. */
export default function MetaTracking({ status }: { status: MetaTrackingView }) {
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  function send(event: React.FormEvent) {
    event.preventDefault();
    start(async () => {
      setNotice(null);
      try {
        const res = await sendMetaTestEvent(code);
        setNotice(res.ok ? { kind: "ok", text: res.message } : { kind: "error", text: res.error });
      } catch {
        setNotice({ kind: "error", text: "Something went wrong" });
      }
    });
  }

  return (
    <div className="glass-panel" style={{ marginBottom: "2rem" }}>
      <h2 style={{ fontSize: "1.15rem", marginBottom: "0.5rem" }}>Meta tracking</h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: "1.25rem", fontSize: "0.9rem" }}>
        The pixel runs in the browser; the Conversions API sends the same events from the server so
        they still count when an ad blocker eats the pixel. Both use one event ID per event, so Meta
        counts each once. Visitors who have not accepted advertising cookies are never sent.
      </p>

      <div className="meta-rows">
        <Row label="Pixel / dataset" value={status.pixelId} />
        <Row
          label="Conversions API token"
          value={status.tokenSet ? "Set" : "Not set — server events are off"}
          tone={status.tokenSet ? "ok" : "bad"}
        />
        <Row
          label="Purchase attribution table"
          value={
            status.table === "ok"
              ? "Ready"
              : status.table === "missing"
                ? "Missing — run `prisma migrate deploy`, or purchases will not be sent"
                : "Could not be read"
          }
          tone={status.table === "ok" ? "ok" : "bad"}
        />
        <Row
          label="Mode"
          value={
            status.testMode
              ? "TEST — META_CAPI_TEST_EVENT_CODE is set, so server events go to Test events only. Remove it to go live."
              : "Live"
          }
          tone={status.testMode ? "warn" : "ok"}
        />
        <Row label="Graph API version" value={status.version} />
      </div>

      <h3 style={{ fontSize: "0.95rem", margin: "1.5rem 0 0.6rem" }}>Last sends since the server started</h3>
      {status.recent.length === 0 ? (
        <p className="cell-note" style={{ marginTop: 0 }}>None yet.</p>
      ) : (
        <ul className="latest-list">
          {status.recent.map((row, i) => (
            <li key={i} className="latest-row">
              <span className="cell-stack">
                <span className="robot-name">
                  {row.events}
                  {row.test ? " · test" : ""}
                </span>
                <span className="cell-note" style={{ marginTop: 0 }}>{row.when} · {row.detail}</span>
              </span>
              <span className="pill" data-tone={row.ok ? "live" : "bad"}>
                {row.ok ? "Accepted" : "Rejected"}
              </span>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={send} style={{ marginTop: "1.5rem" }}>
        <p className="card-label">Check the connection</p>
        <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginBottom: "0.75rem" }}>
          In Events Manager open your pixel → Test events, copy the code shown there, and send a test
          event. It appears there and nowhere else.
        </p>
        {notice && (
          <p className={`admin-notice is-${notice.kind}`} role="status">
            {notice.text}
          </p>
        )}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="enroll-input"
            style={{ maxWidth: "260px" }}
            placeholder="TEST12345"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-label="Test event code"
          />
          <button type="submit" className="btn-primary btn-sm" disabled={pending || !code.trim()}>
            {pending ? "Sending…" : "Send test event"}
          </button>
        </div>
      </form>
    </div>
  );
}
