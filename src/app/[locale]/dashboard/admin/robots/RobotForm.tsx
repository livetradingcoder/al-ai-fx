"use client";

import { useState, useTransition } from "react";
import { createRobot, updateRobot } from "./actions";
import { PRICING_TIERS } from "@/config/pricing";
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
  mode = "edit",
  onClose,
}: {
  robot?: RobotRow;
  mode?: "create" | "edit";
  onClose: () => void;
}) {
  const isCreate = mode === "create" || !robot;

  const [slug, setSlug] = useState(robot?.slug ?? "");
  const [name, setName] = useState(robot?.name ?? "");
  const [shortDescription, setShortDescription] = useState(robot?.shortDescription ?? "");
  const [longDescription, setLongDescription] = useState(robot?.longDescription ?? "");
  const [artworkUrl, setArtworkUrl] = useState(robot?.artworkUrl ?? "");
  const [sortOrder, setSortOrder] = useState(String(robot?.sortOrder ?? 0));
  const [source, setSource] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();

  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        if (isCreate) {
          const fd = new FormData();
          fd.set("slug", slug);
          fd.set("name", name);
          fd.set("shortDescription", shortDescription);
          fd.set("longDescription", longDescription);
          fd.set("artworkUrl", artworkUrl);
          fd.set("sortOrder", sortOrder);
          if (source) fd.set("source", source);
          await createRobot(fd);
        } else {
          await updateRobot(robot!.id, {
            name,
            shortDescription,
            longDescription,
            artworkUrl,
            sortOrder: Number(sortOrder),
          });
        }
        onClose();
      } catch (error) {
        alert(getErrorMessage(error, isCreate ? "Failed to create robot" : "Failed to update robot"));
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
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>{isCreate ? "Add Robot" : "Edit Robot"}</h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <label style={labelStyle} htmlFor="robot-slug">Slug</label>
            {isCreate ? (
              <input
                id="robot-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
                placeholder="e.g. silverbot"
                style={inputStyle}
              />
            ) : (
              <input id="robot-slug" type="text" value={robot!.slug} disabled style={{ ...inputStyle, opacity: 0.6, cursor: "not-allowed" }} />
            )}
            <p style={{ marginTop: "0.35rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
              {isCreate
                ? "Permanent — lowercase kebab; becomes the Blob path."
                : "Slug is permanent (source/download join key)."}
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

          {isCreate && (
            <div>
              <label style={labelStyle} htmlFor="robot-source">Source File (.mq5) — optional</label>
              <input
                id="robot-source"
                type="file"
                name="source"
                accept=".mq5"
                onChange={(e) => setSource(e.target.files?.[0] ?? null)}
                style={{ ...inputStyle, padding: "0.5rem" }}
              />
              <p style={{ marginTop: "0.35rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                If attached, encrypted + uploaded as v1. The robot stays inactive until you activate it.
              </p>
            </div>
          )}

          {!isCreate && (
            <div style={{ border: "1px solid var(--border-color)", borderRadius: "8px", padding: "1rem" }}>
              <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Pricing (read-only)</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                {Object.entries(PRICING_TIERS).map(([tierId, tier]) => (
                  <div key={tierId} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                    <span style={{ color: "var(--text-secondary)" }}>{tierId}</span>
                    <span style={{ fontFamily: "monospace" }}>{tier.priceString}</span>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Pricing is global for now. Per-robot pricing arrives in the catalog phase (Phase 6).
              </p>
            </div>
          )}

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
              {isPending ? (isCreate ? "Creating…" : "Saving…") : isCreate ? "Create Robot" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
