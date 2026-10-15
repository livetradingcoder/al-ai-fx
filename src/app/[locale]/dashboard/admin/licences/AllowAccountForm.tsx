"use client";

import { useState, useTransition } from "react";

import { allowMt5Account, countAccountUse } from "./actions";

/**
 * A free trial refuses an MT5 account that any licence has used. When support
 * decides that was a mistake, the admin enters the account here to let a trial
 * use it again. It says how many licences it is forgetting before it does.
 */
export default function AllowAccountForm() {
  const [account, setAccount] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const target = account.trim();
    if (!target) return;

    start(async () => {
      setNotice(null);
      try {
        const found = await countAccountUse(target);
        if (!found.ok) return setNotice({ kind: "error", text: found.error });
        if (!confirm(`${found.message}\n\nClear that history so a free trial can use ${target} again? The licences keep working.`)) return;

        const res = await allowMt5Account(target);
        setNotice(res.ok ? { kind: "ok", text: res.message } : { kind: "error", text: res.error });
        if (res.ok) setAccount("");
      } catch {
        setNotice({ kind: "error", text: "Could not do that. Try again." });
      }
    });
  }

  return (
    <section className="card" style={{ marginBottom: "20px" }}>
      <p className="card-label">Free-trial rule</p>
      <h2 style={{ fontSize: "1.15rem", margin: "0 0 6px" }}>Allow an MT5 account</h2>
      <p style={{ color: "var(--text-secondary)", margin: "0 0 14px", fontSize: "0.9rem" }}>
        A free trial refuses an MT5 account that any licence has used. If that was a mistake, enter the account here to let a trial use it again.
      </p>
      {notice && (
        <p className={`admin-notice is-${notice.kind}`} role="status">
          {notice.text}
        </p>
      )}
      <form onSubmit={submit} style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <input
          className="enroll-input"
          style={{ flex: "1 1 220px", maxWidth: "320px" }}
          inputMode="numeric"
          placeholder="MT5 account number"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          aria-label="MT5 account number"
        />
        <button type="submit" className="btn-mini" disabled={pending || !account.trim()}>
          {pending ? "Checking…" : "Allow account"}
        </button>
      </form>
    </section>
  );
}
