"use client";

import { useState } from "react";

/** `hasPassword` decides whether the current password is required — accounts
 *  created by magic link have never set one. */
export default function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setState("error");
      setMessage("The two new passwords don't match");
      return;
    }
    setState("saving");
    setMessage("");
    try {
      const res = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: next, currentPassword: current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update password");
      setState("done");
      setMessage("Password updated.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Could not update password");
    }
  }

  return (
    <form onSubmit={submit} className="settings-grid">
      {hasPassword && (
        <div>
          <label className="card-label" htmlFor="currentPassword">Current password</label>
          <input
            id="currentPassword"
            type="password"
            className="enroll-input"
            style={{ width: "100%" }}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </div>
      )}
      <div>
        <label className="card-label" htmlFor="newPassword">New password</label>
        <input
          id="newPassword"
          type="password"
          className="enroll-input"
          style={{ width: "100%" }}
          placeholder="At least 8 characters"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      <div>
        <label className="card-label" htmlFor="confirmPassword">Confirm new</label>
        <input
          id="confirmPassword"
          type="password"
          className="enroll-input"
          style={{ width: "100%" }}
          placeholder="Repeat"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      <div className="settings-grid-actions">
        <button type="submit" className="btn-primary" disabled={state === "saving" || !next}>
          {state === "saving" ? "Updating…" : "Update password"}
        </button>
        {message && (
          <p
            style={{
              marginTop: "10px",
              fontSize: "0.86rem",
              color: state === "error" ? "var(--accent-danger)" : "var(--accent-success)",
            }}
          >
            {message}
          </p>
        )}
      </div>
    </form>
  );
}
