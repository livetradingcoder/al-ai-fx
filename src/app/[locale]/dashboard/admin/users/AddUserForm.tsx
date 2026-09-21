"use client";

import { useState, useTransition } from "react";
import { addUser } from "./actions";

type Notice = { kind: "ok" | "error"; text: string } | null;

/**
 * Adds a person by email and sends them a sign-in link. Mostly for admins:
 * customers get their account automatically at checkout or free trial.
 */
export default function AddUserForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"USER" | "ADMIN">("USER");
  const [notice, setNotice] = useState<Notice>(null);
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
      setNotice(null);
      try {
        const res = await addUser({ email: target, role });
        if (res.ok) {
          setNotice({ kind: "ok", text: res.message });
          setEmail("");
          setRole("USER");
        } else {
          setNotice({ kind: "error", text: res.error });
        }
      } catch {
        setNotice({ kind: "error", text: "Could not add that person. Try again." });
      }
    });
  }

  return (
    <section className="card" style={{ marginBottom: "20px" }}>
      <div className="admin-table-head">
        <div>
          <p className="card-label">Access</p>
          <h2 style={{ fontSize: "1.15rem", margin: 0 }}>Add a person</h2>
        </div>
      </div>

      {notice && (
        <p className={`admin-notice is-${notice.kind}`} role="status">
          {notice.text}
        </p>
      )}

      <form onSubmit={submit}>
        <div className="settings-grid">
          <label>
            <span className="card-label">Email</span>
            <input
              className="enroll-input"
              style={{ marginTop: "8px" }}
              type="email"
              placeholder="name@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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

        <div style={{ marginTop: "20px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" className="btn-primary btn-sm" disabled={pending || !email.trim()}>
            {pending ? "Adding…" : "Add & email sign-in link"}
          </button>
          <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
            Customers don&apos;t need this — buying or starting a trial creates their account.
            An existing email just gets a fresh sign-in link.
          </span>
        </div>
      </form>
    </section>
  );
}
