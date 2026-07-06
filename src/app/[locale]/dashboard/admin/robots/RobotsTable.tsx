"use client";

import { useState } from "react";
import { toggleRobotActive } from "./actions";
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

export default function RobotsTable({ robots }: { robots: RobotRow[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<RobotRow | null>(null);

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
    <div className="glass-panel" style={{ overflowX: "auto" }}>
      <h2 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>All Robots</h2>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          textAlign: "left",
          minWidth: "800px",
        }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
            <th style={{ padding: "1rem", color: "var(--text-secondary)", fontWeight: 500 }}>Slug</th>
            <th style={{ padding: "1rem", color: "var(--text-secondary)", fontWeight: 500 }}>Name</th>
            <th style={{ padding: "1rem", color: "var(--text-secondary)", fontWeight: 500 }}>Active</th>
            <th style={{ padding: "1rem", color: "var(--text-secondary)", fontWeight: 500 }}>Sort</th>
            <th style={{ padding: "1rem", color: "var(--text-secondary)", fontWeight: 500 }}>Src v</th>
            <th style={{ padding: "1rem", color: "var(--text-secondary)", fontWeight: 500, textAlign: "right" }}>Actions</th>
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
                <td style={{ padding: "1.5rem 1rem", fontFamily: "monospace", fontSize: "0.9rem" }}>{robot.slug}</td>
                <td style={{ padding: "1.5rem 1rem" }}>{robot.name}</td>
                <td style={{ padding: "1.5rem 1rem" }}>
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
                <td style={{ padding: "1.5rem 1rem" }}>{robot.sortOrder}</td>
                <td style={{ padding: "1.5rem 1rem" }}>{robot.sourceVersion}</td>
                <td style={{ padding: "1.5rem 1rem", textAlign: "right" }}>
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
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {editing && <RobotForm robot={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
