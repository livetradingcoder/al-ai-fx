"use client";

import { useState, useTransition } from "react";
import { addUser } from "./actions";

/**
 * Adds a person by email and sends them a sign-in link. Mostly for admins:
 * customers get their account automatically at checkout or free trial.
 *
 * Lives in a dialog. A failure stays here so it can be fixed in place; on
 * success `onDone` gets the message and the page shows it above the list,
 * where the new row has appeared.
 */
export default function AddUserForm({ onDone }: { onDone: (message: string) => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"USER" | "ADMIN">("USER");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const target = email.trim().toLowerCase();
    if (!target) return;
    if (
      role === "ADMIN" &&
      !confirm(
        `Give ${target} full admin access? They will see every customer, order and licence, and can create free coupons.`,
      )
    ) {
      return;
    }

    start(async () => {
      setError(null);
      try {
        const res = await addUser({ email: target, role });
        if (res.ok) onDone(res.message);
        else setError(res.error);
      } catch {
        setError("Could not add that person. Try again.");
      }
    });
  }

  return (
    <form onSubmit={submit}>
      {error && (
        <p className="admin-notice is-error" role="alert">
          {error}
        </p>
      )}

      <div style={{ display: "grid", gap: "18px" }}>
        <label>
          <span className="card-label">Email</span>
          <input
            className="enroll-input"
            style={{ marginTop: "8px" }}
            type="email"
            placeholder="name@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-autofocus
          />
        </label>

        <label>
          <span className="card-label">Role</span>
          <select
            className="enroll-input"
            style={{ marginTop: "8px" }}
            value={role}
            onChange={(e) => setRole(e.target.value as "USER" | "ADMIN")}
          >
            <option value="USER">Customer</option>
            <option value="ADMIN">Admin — full dashboard access</option>
          </select>
        </label>
      </div>

      <div style={{ marginTop: "22px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <button type="submit" className="btn-primary btn-sm" disabled={pending || !email.trim()}>
          {pending ? "Adding…" : "Add & email sign-in link"}
        </button>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginTop: "14px" }}>
        Customers don&apos;t need this — buying or starting a trial creates their account.
        An existing email just gets a fresh sign-in link.
      </p>
    </form>
  );
}
