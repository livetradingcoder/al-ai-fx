"use client";

import { useState } from "react";

export default function ProfileForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setMessage("");
    try {
      const res = await fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      setState("saved");
      setMessage("Display name updated.");
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Could not save");
    }
  }

  return (
    <form onSubmit={save}>
      <label className="card-label" htmlFor="displayName">
        Display name
      </label>
      <input
        id="displayName"
        className="enroll-input"
        style={{ width: "100%", maxWidth: "420px", display: "block" }}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setState("idle");
        }}
        maxLength={60}
      />
      <button
        type="submit"
        className="btn-primary"
        style={{ marginTop: "16px" }}
        disabled={state === "saving" || name.trim() === initialName.trim()}
      >
        {state === "saving" ? "Saving…" : "Save changes"}
      </button>
      {message && (
        <p
          style={{
            marginTop: "12px",
            fontSize: "0.86rem",
            color: state === "error" ? "var(--accent-danger)" : "var(--accent-success)",
          }}
        >
          {message}
        </p>
      )}
    </form>
  );
}
