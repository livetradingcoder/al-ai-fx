"use client";

import { useState } from "react";

/**
 * Waitlist capture for a feature that does not exist yet ("Pay After Trial").
 * Writes to the same EmailSubscriber table the school site feeds, tagged with
 * its own source so the waitlist can be mailed separately when it ships.
 */
export default function NotifyMeForm({ source }: { source: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.includes("@")) {
      setState("error");
      setMessage("Enter a valid email.");
      return;
    }
    setState("sending");
    try {
      const res = await fetch("/api/marketing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), source }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save that.");
      setState("done");
      setMessage("You're on the list — we'll email you when it opens.");
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Could not save that.");
    }
  }

  if (state === "done") {
    return (
      <p className="pricing-tier-preview-cta" style={{ color: "var(--accent-accent)", textAlign: "center" }}>
        {message}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn-secondary fill pricing-tier-preview-cta"
        onClick={() => setOpen(true)}
      >
        Notify Me When Ready
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: "0.5rem" }}>
      <input
        type="email"
        autoFocus
        placeholder="you@domain.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (state === "error") setState("idle");
        }}
        style={{
          padding: "0.85rem 1rem",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border-color)",
          background: "var(--bg-secondary)",
          color: "var(--text-primary)",
          fontFamily: "inherit",
          width: "100%",
        }}
      />
      <button type="submit" className="btn-primary fill" disabled={state === "sending"}>
        {state === "sending" ? "Adding…" : "Add me to the list"}
      </button>
      {state === "error" && (
        <p style={{ margin: 0, fontSize: "0.82rem", color: "#fca5a5", textAlign: "center" }}>{message}</p>
      )}
    </form>
  );
}
