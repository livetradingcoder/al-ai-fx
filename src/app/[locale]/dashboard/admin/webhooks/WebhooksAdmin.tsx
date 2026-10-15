"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";
import Dialog from "@/components/dashboard/Dialog";
import {
  createWebhook,
  deleteWebhook,
  redeliverWebhook,
  sendWebhookTest,
  setWebhookEnabled,
  updateWebhook,
} from "./actions";

export type WebhookRow = {
  id: string;
  name: string;
  url: string;
  /** Last four characters only: the secret itself never reaches the browser. */
  secretHint: string;
  events: string[];
  enabled: boolean;
  signatureFormat: string;
  delivered24h: number;
  failed24h: number;
};

export type DeliveryRow = {
  id: string;
  webhookName: string;
  event: string;
  status: string;
  attempts: number;
  httpStatus: number | null;
  durationMs: number | null;
  error: string | null;
  responseBody: string | null;
  payload: string;
  createdAt: string;
};

type Notice = { kind: "ok" | "error"; text: string } | null;

const EVENT_OPTIONS = [
  { key: "user.signup", label: "New signup", hint: "An account was created" },
  { key: "trial.started", label: "Free trial", hint: "Someone started a free trial" },
  { key: "sale.completed", label: "Sale", hint: "An order was paid, or a free order placed" },
];

const EVENT_LABEL: Record<string, string> = {
  "user.signup": "signup",
  "trial.started": "trial",
  "sale.completed": "sale",
  "webhook.test": "test",
};

const EMPTY_FORM = {
  name: "",
  url: "",
  secret: "",
  events: EVENT_OPTIONS.map((e) => e.key),
  signatureFormat: "hex",
  enabled: true,
};

function statusTone(status: string) {
  if (status === "DELIVERED") return "live" as const;
  if (status === "FAILED") return "bad" as const;
  return "soon" as const;
}

function hostOf(url: string) {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname.length > 1 ? "/…" : ""}`;
  } catch {
    return url;
  }
}

export default function WebhooksAdmin({
  webhooks,
  deliveries,
  disabled,
}: {
  webhooks: WebhookRow[];
  deliveries: DeliveryRow[];
  disabled: boolean;
}) {
  const [notice, setNotice] = useState<Notice>(null);
  // null = closed, "new" = creating, otherwise the id being edited.
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (id: string, fn: () => Promise<ActionResult>) =>
    start(async () => {
      setNotice(null);
      setBusyId(id);
      try {
        const res = await fn();
        setNotice(res.ok ? { kind: "ok", text: res.message } : { kind: "error", text: res.error });
      } catch {
        setNotice({ kind: "error", text: "Something went wrong" });
      } finally {
        setBusyId(null);
      }
    });

  function openNew() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setEditing("new");
  }

  function openEdit(w: WebhookRow) {
    setForm({
      name: w.name,
      url: w.url,
      secret: "",
      events: w.events,
      signatureFormat: w.signatureFormat,
      enabled: w.enabled,
    });
    setFormError(null);
    setEditing(w.id);
  }

  function close() {
    setEditing(null);
    setFormError(null);
  }

  const toggleEvent = (key: string) =>
    setForm((f) => ({
      ...f,
      events: f.events.includes(key) ? f.events.filter((e) => e !== key) : [...f.events, key],
    }));

  // A failure stays in the dialog so it can be fixed in place; success closes
  // it and reports above the list.
  const save = () =>
    start(async () => {
      setFormError(null);
      try {
        const res = editing === "new" ? await createWebhook(form) : await updateWebhook(editing as string, form);
        if (res.ok) {
          close();
          setNotice({ kind: "ok", text: res.message });
        } else {
          setFormError(res.error);
        }
      } catch {
        setFormError("Something went wrong");
      }
    });

  const editingRow = editing && editing !== "new" ? webhooks.find((w) => w.id === editing) : null;

  return (
    <>
      <section className="card">
        <div className="admin-table-head">
          <div>
            <p className="card-label">Endpoints</p>
            <h2 style={{ fontSize: "1.15rem", margin: 0 }}>Where events are sent</h2>
          </div>
          <button type="button" className="btn-primary btn-sm" disabled={disabled} onClick={openNew}>
            Add webhook
          </button>
        </div>

        <Dialog
          open={editing !== null}
          onClose={close}
          eyebrow={editing === "new" ? "New webhook" : "Edit webhook"}
          title={editing === "new" ? "Add a webhook" : `Edit ${editingRow?.name ?? "webhook"}`}
          wide
        >
          {formError && (
            <p className="admin-notice is-error" role="alert">
              {formError}
            </p>
          )}

          <div className="settings-grid">
            <label>
              <span className="card-label">Name</span>
              <input
                className="enroll-input"
                style={{ marginTop: "8px" }}
                data-autofocus
                placeholder="WhatsApp relay"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>

            <label>
              <span className="card-label">Webhook URL</span>
              <input
                className="enroll-input"
                style={{ marginTop: "8px" }}
                inputMode="url"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="https://…/api/webhooks/relay/…"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
            </label>

            <label style={{ gridColumn: "1 / -1" }}>
              <span className="card-label">
                Secret{editingRow ? ` (leave blank to keep ••••${editingRow.secretHint})` : ""}
              </span>
              <input
                className="enroll-input"
                style={{ marginTop: "8px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={editingRow ? "unchanged" : "Paste the secret from the receiving app"}
                value={form.secret}
                onChange={(e) => setForm({ ...form, secret: e.target.value })}
              />
            </label>
          </div>

          <fieldset style={{ border: 0, padding: 0, margin: "18px 0 0" }}>
            <legend className="card-label" style={{ marginBottom: "8px" }}>
              Send these events
            </legend>
            <div style={{ display: "grid", gap: "8px" }}>
              {EVENT_OPTIONS.map((o) => (
                <label key={o.key} style={{ display: "flex", gap: "10px", alignItems: "center", fontSize: "0.9rem" }}>
                  <input type="checkbox" checked={form.events.includes(o.key)} onChange={() => toggleEvent(o.key)} />
                  <span>
                    {o.label} <span className="cell-note">· {o.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "16px", fontSize: "0.9rem" }}>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            Enabled
          </label>

          <details style={{ marginTop: "16px" }}>
            <summary className="card-label" style={{ cursor: "pointer" }}>
              Advanced
            </summary>
            <label style={{ display: "block", marginTop: "10px" }}>
              <span className="card-label">Signature header format</span>
              <select
                className="enroll-input"
                style={{ marginTop: "8px" }}
                value={form.signatureFormat}
                onChange={(e) => setForm({ ...form, signatureFormat: e.target.value })}
              >
                <option value="hex">Bare hex — X-Webhook-Signature: &lt;hex&gt; (default)</option>
                <option value="prefixed">Prefixed — X-Webhook-Signature: sha256=&lt;hex&gt;</option>
              </select>
            </label>
            <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", margin: "8px 0 0" }}>
              The same signature is always also sent as <code>X-Hub-Signature-256: sha256=&lt;hex&gt;</code>.
              Only change this if the receiver rejects the default.
            </p>
          </details>

          <div style={{ marginTop: "20px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={pending || !form.name.trim() || !form.url.trim()}
              onClick={save}
            >
              {pending ? "Saving…" : editing === "new" ? "Add webhook" : "Save changes"}
            </button>
            <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
              After saving, use “Send test” to confirm the receiver accepts it.
            </span>
          </div>
        </Dialog>

        {notice && (
          <p className={`admin-notice is-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
            {notice.text}
          </p>
        )}

        <div className="table-wrap">
          <table className="data-table is-wide">
            <thead>
              <tr>
                <th>Name</th>
                <th>Sends</th>
                <th>Last 24 h</th>
                <th>State</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {webhooks.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                    No webhooks yet. Add one to start sending events.
                  </td>
                </tr>
              )}
              {webhooks.map((w) => (
                <tr key={w.id} data-dim={w.enabled ? undefined : "true"}>
                  <td data-label="Name">
                    <span className="cell-stack">
                      <span className="robot-name">{w.name}</span>
                      <span className="cell-note" title={w.url}>
                        {hostOf(w.url)} · secret ••••{w.secretHint}
                      </span>
                    </span>
                  </td>
                  <td data-label="Sends">
                    <span style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {w.events.map((e) => (
                        <span key={e} className="pill">
                          {EVENT_LABEL[e] ?? e}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td data-label="Last 24 h">
                    <span className="cell-stack">
                      <span>{w.delivered24h} delivered</span>
                      {w.failed24h > 0 && <span className="cell-note" style={{ color: "#efa094" }}>{w.failed24h} failed</span>}
                    </span>
                  </td>
                  <td data-label="State">
                    <span className="pill" data-tone={w.enabled ? "live" : undefined}>
                      {w.enabled ? "On" : "Off"}
                    </span>
                  </td>
                  <td data-label="Actions" className="cell-actions">
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn-mini is-go"
                        disabled={pending}
                        onClick={() => run(w.id, () => sendWebhookTest(w.id))}
                      >
                        {pending && busyId === w.id ? "Sending…" : "Send test"}
                      </button>
                      <button type="button" className="btn-mini" disabled={pending} onClick={() => openEdit(w)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-mini"
                        disabled={pending}
                        onClick={() => run(w.id, () => setWebhookEnabled(w.id, !w.enabled))}
                      >
                        {w.enabled ? "Switch off" : "Switch on"}
                      </button>
                      <button
                        type="button"
                        className="btn-mini is-danger"
                        disabled={pending}
                        onClick={() => {
                          if (window.confirm(`Delete “${w.name}” and its delivery log?`)) {
                            run(w.id, () => deleteWebhook(w.id));
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" style={{ marginTop: "20px" }}>
        <p className="card-label">Deliveries</p>
        <h2 style={{ fontSize: "1.15rem", margin: "6px 0 16px" }}>
          Recent deliveries{deliveries.length > 0 ? ` · last ${deliveries.length}` : ""}
        </h2>
        <div className="table-wrap">
          <table className="data-table is-wide">
            <thead>
              <tr>
                <th>When</th>
                <th>Webhook</th>
                <th>Event</th>
                <th>Result</th>
                <th style={{ textAlign: "right" }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                    Nothing sent yet. The log fills as signups and sales come in — or send a test.
                  </td>
                </tr>
              )}
              {deliveries.map((d) => (
                <tr key={d.id}>
                  <td data-label="When">{new Date(d.createdAt).toLocaleString()}</td>
                  <td data-label="Webhook">{d.webhookName}</td>
                  <td data-label="Event">
                    <span className="pill">{EVENT_LABEL[d.event] ?? d.event}</span>
                  </td>
                  <td data-label="Result">
                    <span className="cell-stack">
                      <span>
                        <span className="pill" data-tone={statusTone(d.status)}>
                          {d.status.toLowerCase()}
                        </span>
                      </span>
                      <span className="cell-note">
                        {d.httpStatus ? `HTTP ${d.httpStatus}` : "no response"}
                        {d.durationMs != null ? ` · ${d.durationMs} ms` : ""}
                        {d.attempts > 1 ? ` · ${d.attempts} attempts` : ""}
                      </span>
                    </span>
                  </td>
                  <td data-label="Details" className="cell-actions">
                    <div className="row-actions">
                      {d.status === "FAILED" && (
                        <button
                          type="button"
                          className="btn-mini is-go"
                          disabled={pending}
                          onClick={() => run(d.id, () => redeliverWebhook(d.id))}
                        >
                          {pending && busyId === d.id ? "Sending…" : "Send again"}
                        </button>
                      )}
                      <details className="webhook-detail">
                        <summary className="btn-mini" style={{ cursor: "pointer" }}>
                          View
                        </summary>
                        <div style={{ textAlign: "left", marginTop: "10px", minWidth: "min(480px, 70vw)" }}>
                          {d.error && (
                            <p className="admin-notice is-error" style={{ margin: "0 0 10px" }}>
                              {d.error}
                            </p>
                          )}
                          {d.responseBody && (
                            <>
                              <p className="card-label">Receiver replied</p>
                              <pre style={preStyle}>{d.responseBody}</pre>
                            </>
                          )}
                          <p className="card-label" style={{ marginTop: "10px" }}>
                            Body sent
                          </p>
                          <pre style={preStyle}>{d.payload}</pre>
                        </div>
                      </details>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="admin-legend">Deliveries are kept for 30 days.</p>
      </section>
    </>
  );
}

const preStyle: React.CSSProperties = {
  margin: "6px 0 0",
  padding: "10px 12px",
  maxHeight: "260px",
  overflow: "auto",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  fontSize: "0.76rem",
  borderRadius: "8px",
  border: "1px solid var(--border-color)",
  background: "rgba(0,0,0,0.25)",
};
