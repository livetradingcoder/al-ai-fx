"use client";

import { useRef, useState, useTransition } from "react";
import { toggleRobotActive, uploadRobotSource } from "./actions";
import RobotForm from "./RobotForm";

export interface RobotRow {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  active: boolean;
  artworkUrl: string | null;
  sortOrder: number;
  sourceVersion: number;
}

function UploadSourceButton({ robotId }: { robotId: string }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [isPending, startTransition] = useTransition();

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // reset the input so the same file can be re-selected later
    e.target.value = "";
    if (!file) return;
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("robotId", robotId);
        fd.set("source", file);
        const res = await uploadRobotSource(fd);
        alert(`Source uploaded — now at v${res.version}.`);
      } catch (error) {
        alert(error instanceof Error ? error.message : "Failed to upload source");
      }
    });
  }

  return (
    <>
      <input ref={fileRef} type="file" accept=".mq5" onChange={onPick} style={{ display: "none" }} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={isPending}
        style={{
          padding: "0.4rem 0.8rem",
          fontSize: "0.8rem",
          backgroundColor: "#8B5CF6",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: isPending ? "not-allowed" : "pointer",
          opacity: isPending ? 0.7 : 1,
        }}
      >
        {isPending ? "Uploading…" : "Upload Source"}
      </button>
    </>
  );
}

export default function RobotsTable({ robots }: { robots: RobotRow[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<RobotRow | null>(null);
  const [creating, setCreating] = useState(false);

  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;

  async function handleToggle(robotId: string, currentActive: boolean) {
    setLoadingId(robotId);
    try {
      await toggleRobotActive(robotId, currentActive);
    } catch (error) {
      alert(getErrorMessage(error, "Failed to update active status"));
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.5rem" }}>All Robots</h2>
        <button
          onClick={() => setCreating(true)}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "0.85rem",
            backgroundColor: "#10B981",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          + Add Robot
        </button>
      </div>
      <div className="table-wrap">
      <table className="data-table" style={{ minWidth: "800px" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
            <th>Slug</th>
            <th>Name</th>
            <th>Active</th>
            <th>Sort</th>
            <th>Src v</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {robots.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                No robots found.
              </td>
            </tr>
          )}
          {robots.map((robot) => {
            const isLoading = loadingId === robot.id;
            return (
              <tr
                key={robot.id}
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  backgroundColor: robot.active ? "transparent" : "rgba(255,255,255,0.03)",
                }}
              >
                <td data-label="Slug" style={{ padding: "1.5rem 1rem", fontFamily: "monospace", fontSize: "0.9rem" }}>{robot.slug}</td>
                <td data-label="Name" style={{ padding: "1.5rem 1rem" }}>{robot.name}</td>
                <td data-label="Active" style={{ padding: "1.5rem 1rem" }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      backgroundColor: robot.active ? "#10B981" : "#6b7280",
                      color: "white",
                      padding: "0.15rem 0.5rem",
                      borderRadius: "4px",
                    }}
                  >
                    {robot.active ? "ACTIVE" : "INACTIVE"}
                  </span>
                </td>
                <td data-label="Sort" style={{ padding: "1.5rem 1rem" }}>{robot.sortOrder}</td>
                <td data-label="Src v" style={{ padding: "1.5rem 1rem" }}>{robot.sourceVersion}</td>
                <td data-label="Actions" style={{ padding: "1.5rem 1rem", textAlign: "right" }}>
                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => handleToggle(robot.id, robot.active)}
                      disabled={isLoading}
                      style={{
                        padding: "0.4rem 0.8rem",
                        fontSize: "0.8rem",
                        backgroundColor: robot.active ? "#F59E0B" : "#10B981",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        cursor: isLoading ? "not-allowed" : "pointer",
                        opacity: isLoading ? 0.7 : 1,
                      }}
                    >
                      {robot.active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => setEditing(robot)}
                      disabled={isLoading}
                      style={{
                        padding: "0.4rem 0.8rem",
                        fontSize: "0.8rem",
                        backgroundColor: "#3B82F6",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        cursor: isLoading ? "not-allowed" : "pointer",
                        opacity: isLoading ? 0.7 : 1,
                      }}
                    >
                      Edit
                    </button>
                    <UploadSourceButton robotId={robot.id} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table></div>

      {editing && <RobotForm robot={editing} mode="edit" onClose={() => setEditing(null)} />}
      {creating && <RobotForm mode="create" onClose={() => setCreating(false)} />}
    </div>
  );
}
