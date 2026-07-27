"use client";

import { useState } from "react";

export default function SupportForm() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send");
      setState("sent");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Could not send");
    }
  }

  if (state === "sent") {
    return (
      <div style={{ textAlign: "center", padding: "16px 0" }}>
        <p style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "8px" }}>
          Message sent
        </p>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          We replied to your inbox with a copy. You&apos;ll hear from us at the email on your
          account.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <label className="card-label" htmlFor="supportSubject">Subject</label>
      <input
        id="supportSubject"
        className="enroll-input"
        style={{ width: "100%", display: "block", marginBottom: "16px" }}
        placeholder="Robot won't load in MetaTrader"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        maxLength={120}
        required
      />

      <label className="card-label" htmlFor="supportMessage">What&apos;s happening?</label>
      <textarea
        id="supportMessage"
        className="enroll-input"
        style={{ width: "100%", display: "block", minHeight: "160px", resize: "vertical" }}
        placeholder="Tell us what you did, what you expected, and what happened instead. Include your broker if it's about installing the robot."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={4000}
        required
      />

      <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", margin: "10px 0 18px" }}>
        Your licences and MT5 numbers are attached automatically, so you don&apos;t have to look
        them up.
      </p>

      <button type="submit" className="btn-primary" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Send message"}
      </button>

      {state === "error" && (
        <p style={{ marginTop: "12px", fontSize: "0.86rem", color: "var(--accent-danger)" }}>
          {error}
        </p>
      )}
    </form>
  );
}
