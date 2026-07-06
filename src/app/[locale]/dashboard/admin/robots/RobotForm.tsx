"use client";

import { useState, useTransition } from "react";
import { updateRobot } from "./actions";
import type { RobotRow } from "./RobotsTable";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.8rem",
  backgroundColor: "rgba(255,255,255,0.05)",
  border: "1px solid var(--border-color)",
  borderRadius: "6px",
  color: "var(--text-primary)",
  font: "inherit",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "0.4rem",
  fontSize: "0.85rem",
  color: "var(--text-secondary)",
};

export default function RobotForm({
  robot,
  onClose,
}: {
  robot: RobotRow;
  onClose: () => void;
}) {
  const [name, setName] = useState(robot.name);
  const [shortDescription, setShortDescription] = useState(robot.shortDescription);
  const [longDescription, setLongDescription] = useState(robot.longDescription);
  const [artworkUrl, setArtworkUrl] = useState(robot.artworkUrl ?? "");
  const [sortOrder, setSortOrder] = useState(String(robot.sortOrder));
  const [isPending, startTransition] = useTransition();

  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateRobot(robot.id, {
          name,
          shortDescription,
          longDescription,
          artworkUrl,
          sortOrder: Number(sortOrder),
        });
        onClose();
      } catch (error) {
        alert(getErrorMessage(error, "Failed to update robot"));
      }
    });
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: "2rem",
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{ maxWidth: "560px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Edit Robot</h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <label style={labelStyle} htmlFor="robot-slug">Slug</label>
            <input id="robot-slug" type="text" value={robot.slug} disabled style={{ ...inputStyle, opacity: 0.6, cursor: "not-allowed" }} />
            <p style={{ marginTop: "0.35rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Slug is permanent (source/download join key).
            </p>
          </div>

          <div>
            <label style={labelStyle} htmlFor="robot-name">Name</label>
            <input id="robot-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle} htmlFor="robot-short">Short Description</label>
            <input id="robot-short" type="text" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} required style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle} htmlFor="robot-long">Long Description</label>
            <textarea id="robot-long" value={longDescription} onChange={(e) => setLongDescription(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          <div>
            <label style={labelStyle} htmlFor="robot-artwork">Artwork URL</label>
            <input id="robot-artwork" type="text" value={artworkUrl} onChange={(e) => setArtworkUrl(e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle} htmlFor="robot-sort">Sort Order</label>
            <input id="robot-sort" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              style={{ padding: "0.6rem 1.2rem", fontSize: "0.9rem", backgroundColor: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-color)", borderRadius: "6px", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              style={{ padding: "0.6rem 1.2rem", fontSize: "0.9rem", backgroundColor: "#10B981", color: "#fff", border: "none", borderRadius: "6px", cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1 }}
            >
              {isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
