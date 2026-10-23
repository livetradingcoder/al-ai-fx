"use client";

import { useState, useTransition } from "react";
import { setProviderEnabled } from "./actions";
import type { PaymentProvider } from "@/lib/payment-settings";

export type ProviderRow = {
  id: PaymentProvider;
  name: string;
  method: string;
  enabled: boolean;
  configured: boolean;
  envHint: string;
};

type Notice = { kind: "ok" | "error"; text: string } | null;

function state(p: ProviderRow) {
  if (p.enabled && p.configured) return { label: "Offered", tone: "live" as const };
  if (p.enabled) return { label: "On · keys missing", tone: "bad" as const };
  return { label: "Off", tone: undefined };
}

export default function PaymentsAdmin({ providers }: { providers: ProviderRow[] }) {
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, start] = useTransition();
  const offered = providers.filter((p) => p.enabled && p.configured);

  const toggle = (p: ProviderRow) =>
    start(async () => {
      setNotice(null);
      try {
        const res = await setProviderEnabled(p.id, !p.enabled);
        setNotice(res.ok ? { kind: "ok", text: res.message } : { kind: "error", text: res.error });
      } catch {
        setNotice({ kind: "error", text: "Something went wrong" });
      }
    });

  return (
    <section className="card">
      <p className="card-label">Checkout</p>
      <h2 style={{ fontSize: "1.15rem", margin: "6px 0 16px" }}>
        {offered.length === 0
          ? "Nothing is offered — buyers can't pay right now"
          : `Offered: ${offered.map((p) => `${p.method} by ${p.name}`).join(" · ")}`}
      </h2>

      {notice && (
        <p className={`admin-notice is-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
          {notice.text}
        </p>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Keys</th>
              <th>State</th>
              <th style={{ textAlign: "right" }}>Switch</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => {
              const s = state(p);
              return (
                <tr key={p.id} data-dim={p.enabled ? undefined : "true"}>
                  <td data-label="Provider">
                    <span className="cell-stack">
                      <span className="robot-name">{p.name}</span>
                      <span className="cell-note">{p.method} payments</span>
                    </span>
                  </td>
                  <td data-label="Keys">
                    <span className="cell-stack">
                      <span>{p.configured ? "Set" : "Missing"}</span>
                      {!p.configured && <span className="cell-note">{p.envHint}</span>}
                    </span>
                  </td>
                  <td data-label="State">
                    <span className="pill" data-tone={s.tone}>
                      {s.label}
                    </span>
                  </td>
                  <td data-label="Switch" className="cell-actions">
                    <div className="row-actions">
                      <button
                        type="button"
                        className={`btn-mini ${p.enabled ? "is-danger" : "is-go"}`}
                        disabled={pending}
                        onClick={() => toggle(p)}
                      >
                        {p.enabled ? "Switch off" : "Switch on"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="admin-legend">
        Free trials and 100% coupon codes don&apos;t go through a provider, so they keep working whatever is
        switched off.
      </p>
    </section>
  );
}
