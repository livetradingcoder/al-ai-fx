"use client";

import { useState, useTransition } from "react";

import Dialog from "@/components/dashboard/Dialog";
import type { ActionResult } from "@/lib/action-result";
import { drawGiveawayWinner, saveGiveaway, setGiveawayLive } from "./actions";
import { formatDate } from "@/lib/format-date";

export type GiveawayRow = {
  id: string;
  slug: string;
  title: string;
  prize: string;
  rulesText: string;
  startsAt: string;
  endsAt: string;
  status: "DRAFT" | "LIVE" | "DRAWN";
  entries: number;
  winner: string | null;
};

type Notice = { kind: "ok" | "error"; text: string } | null;

const TONE = { DRAFT: "off", LIVE: "live", DRAWN: "soon" } as const;

const DEFAULT_RULES = `Who can enter: anyone aged 18 or over, in a country where this giveaway is offered. No purchase is necessary to enter or to win.
How to enter: submit your email on the giveaway page. One entry per person. A paid trial on the same email adds nine chances; sharing your results (reviewed by us) earns one more each time.
The draw: after the closing date we pick one winner at random from all valid entries and contact them by email. If we cannot reach the winner within 7 days we may draw again.
Marketing emails are optional and separate from entering. You can unsubscribe at any time.
We may exclude entries that break these rules. Not open where prohibited by law.`;

/** <input type="datetime-local"> wants local time without a zone. */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function inDays(days: number) {
  return toLocalInput(new Date(Date.now() + days * 86_400_000).toISOString());
}

export default function GiveawaysAdmin({ giveaways, optedIn }: { giveaways: GiveawayRow[]; optedIn: number }) {
  const [notice, setNotice] = useState<Notice>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [pending, start] = useTransition();
  // Fixed when the page loads: "has it closed yet" does not need to tick.
  const [now] = useState(() => Date.now());
  const [form, setForm] = useState({
    slug: "",
    title: "",
    prize: "",
    rulesText: DEFAULT_RULES,
    startsAt: toLocalInput(new Date().toISOString()),
    endsAt: inDays(14),
    live: true,
  });

  function openNew() {
    setForm({
      slug: "",
      title: "",
      prize: "",
      rulesText: DEFAULT_RULES,
      startsAt: toLocalInput(new Date().toISOString()),
      endsAt: inDays(14),
      live: true,
    });
    setFormError(null);
    setEditing({ id: null });
  }

  function openEdit(g: GiveawayRow) {
    setForm({
      slug: g.slug,
      title: g.title,
      prize: g.prize,
      rulesText: g.rulesText,
      startsAt: toLocalInput(g.startsAt),
      endsAt: toLocalInput(g.endsAt),
      live: g.status === "LIVE",
    });
    setFormError(null);
    setEditing({ id: g.id });
  }

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

  const save = () =>
    start(async () => {
      setFormError(null);
      try {
        const res = await saveGiveaway({
          id: editing?.id ?? null,
          slug: form.slug,
          title: form.title,
          prize: form.prize,
          rulesText: form.rulesText,
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString(),
          live: form.live,
        });
        if (res.ok) {
          setEditing(null);
          setNotice({ kind: "ok", text: res.message });
        } else {
          setFormError(res.error);
        }
      } catch {
        setFormError("Something went wrong");
      }
    });

  return (
    <>
      <section className="card">
        <div className="admin-table-head">
          <div>
            <p className="card-label">Draws</p>
            <h2 style={{ fontSize: "1.15rem", margin: 0 }}>All giveaways</h2>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {/* A file download, not a page: a plain anchor is right. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a className="btn-secondary btn-sm" href="/api/admin/segments/giveaway-subscribers">
              Download opted-in list ({optedIn})
            </a>
            <button type="button" className="btn-primary btn-sm" onClick={openNew}>
              New giveaway
            </button>
          </div>
        </div>

        <Dialog
          open={editing !== null}
          onClose={() => setEditing(null)}
          eyebrow={editing?.id ? "Edit" : "New"}
          title={editing?.id ? "Edit giveaway" : "Create a giveaway"}
          wide
        >
          {formError && (
            <p className="admin-notice is-error" role="alert">
              {formError}
            </p>
          )}
          <div className="settings-grid">
            <label>
              <span className="card-label">Title</span>
              <input className="enroll-input" style={{ marginTop: "8px" }} data-autofocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="October GoldBot giveaway" />
            </label>
            <label>
              <span className="card-label">Slug</span>
              <input className="enroll-input" style={{ marginTop: "8px" }} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} placeholder="october-2026" />
            </label>
            <label>
              <span className="card-label">Prize</span>
              <input className="enroll-input" style={{ marginTop: "8px" }} value={form.prize} onChange={(e) => setForm({ ...form, prize: e.target.value })} placeholder="3 weeks of GoldBot, free" />
            </label>
            <label>
              <span className="card-label">Starts</span>
              <input className="enroll-input" style={{ marginTop: "8px" }} type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
            </label>
            <label>
              <span className="card-label">Ends</span>
              <input className="enroll-input" style={{ marginTop: "8px" }} type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
            </label>
          </div>

          <label style={{ display: "block", marginTop: "16px" }}>
            <span className="card-label">Rules (shown publicly on the giveaway page)</span>
            <textarea
              className="enroll-input"
              style={{ marginTop: "8px", minHeight: "190px", width: "100%", fontFamily: "inherit" }}
              value={form.rulesText}
              onChange={(e) => setForm({ ...form, rulesText: e.target.value })}
            />
          </label>

          <label style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "16px", fontSize: "0.88rem" }}>
            <input type="checkbox" checked={form.live} onChange={(e) => setForm({ ...form, live: e.target.checked })} />
            Live (visible on the site and taking entries)
          </label>

          <div style={{ marginTop: "20px" }}>
            <button type="button" className="btn-primary btn-sm" disabled={pending || !form.title.trim() || !form.slug.trim()} onClick={save}>
              {pending ? "Working…" : "Save giveaway"}
            </button>
          </div>
        </Dialog>

        {notice && <p className={`admin-notice is-${notice.kind}`}>{notice.text}</p>}

        <div className="table-wrap">
          <table className="data-table is-wide">
            <thead>
              <tr>
                <th>Giveaway</th>
                <th>Window</th>
                <th>Entries</th>
                <th>State</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {giveaways.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                    No giveaways yet. Create one and the pop-up and page switch on.
                  </td>
                </tr>
              )}
              {giveaways.map((g) => {
                const ended = new Date(g.endsAt).getTime() <= now;
                return (
                  <tr key={g.id}>
                    <td data-label="Giveaway">
                      <span className="cell-stack">
                        <span>{g.title}</span>
                        <span className="cell-note">{g.prize}</span>
                        {g.winner && <span className="cell-note">Winner: {g.winner}</span>}
                      </span>
                    </td>
                    <td data-label="Window">
                      <span className="cell-note">
                        {formatDate(g.startsAt)} – {formatDate(g.endsAt)}
                      </span>
                    </td>
                    <td data-label="Entries">{g.entries}</td>
                    <td data-label="State">
                      <span className="pill" data-tone={TONE[g.status]}>{g.status.toLowerCase()}</span>
                    </td>
                    <td data-label="Actions" style={{ textAlign: "right" }}>
                      <span style={{ display: "inline-flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <a className="btn-mini" href={`/api/admin/segments/giveaway-entries?giveaway=${g.id}`}>
                          Entries CSV
                        </a>
                        {g.status !== "DRAWN" && (
                          <>
                            <button type="button" className="btn-mini" disabled={pending} onClick={() => openEdit(g)}>
                              Edit
                            </button>
                            <button type="button" className="btn-mini" disabled={pending} onClick={() => run(() => setGiveawayLive({ id: g.id, live: g.status !== "LIVE" }))}>
                              {g.status === "LIVE" ? "Switch off" : "Go live"}
                            </button>
                            <button
                              type="button"
                              className="btn-mini is-go"
                              disabled={pending || !ended || g.entries === 0}
                              title={ended ? "Pick the winner" : "Available after the closing date"}
                              onClick={() => {
                                if (window.confirm(`Draw the winner of “${g.title}” now? This cannot be undone.`)) {
                                  run(() => drawGiveawayWinner({ id: g.id }));
                                }
                              }}
                            >
                              Draw winner
                            </button>
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
