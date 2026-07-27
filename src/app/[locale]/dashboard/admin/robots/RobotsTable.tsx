"use client";

import { useRef, useState, useTransition } from "react";
import { toggleRobotActive, uploadRobotSource } from "./actions";
import RobotForm from "./RobotForm";
import {
  TablePager,
  TableToolbar,
  useTableView,
  type FilterDef,
  type SortDef,
} from "@/components/dashboard/table-view";

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
  paidTiers: number;
  cheapestPaid: number | null;
  hasFreeTrial: boolean;
  subscriptions: number;
}

type Notice = { kind: "ok" | "error"; text: string };

/** What a customer sees on /catalog for this row. */
function storefront(robot: RobotRow) {
  if (!robot.active) return { label: "Hidden", tone: "off" as const };
  if (robot.paidTiers === 0 && !robot.hasFreeTrial)
    return { label: "Coming soon", tone: "soon" as const };
  return { label: "Selling", tone: "live" as const };
}

function UploadSourceButton({
  robotId,
  onDone,
}: {
  robotId: string;
  onDone: (n: Notice) => void;
}) {
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
        onDone({ kind: "ok", text: `Source uploaded — now at v${res.version}.` });
      } catch (error) {
        onDone({
          kind: "error",
          text: error instanceof Error ? error.message : "Failed to upload source",
        });
      }
    });
  }

  return (
    <>
      <input ref={fileRef} type="file" accept=".mq5" onChange={onPick} style={{ display: "none" }} />
      <button
        type="button"
        className="btn-mini"
        onClick={() => fileRef.current?.click()}
        disabled={isPending}
      >
        {isPending ? "Uploading…" : "Upload source"}
      </button>
    </>
  );
}

const FILTERS: FilterDef<RobotRow>[] = [
  { key: "selling", label: "Selling", test: (r) => storefront(r).tone === "live" },
  { key: "soon", label: "Coming soon", test: (r) => storefront(r).tone === "soon" },
  { key: "hidden", label: "Hidden", test: (r) => !r.active },
  { key: "trial", label: "With a free trial", test: (r) => r.hasFreeTrial },
];

const SORTS: SortDef<RobotRow>[] = [
  { key: "order", label: "Catalog order", compare: (a, b) => a.sortOrder - b.sortOrder },
  { key: "name", label: "Name A–Z", compare: (a, b) => a.name.localeCompare(b.name) },
  { key: "licences", label: "Most licences", compare: (a, b) => b.subscriptions - a.subscriptions },
  { key: "price", label: "Cheapest first", compare: (a, b) => (a.cheapestPaid ?? Infinity) - (b.cheapestPaid ?? Infinity) },
  { key: "source", label: "Newest source", compare: (a, b) => b.sourceVersion - a.sourceVersion },
];

export default function RobotsTable({ robots }: { robots: RobotRow[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<RobotRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const view = useTableView(robots, {
    search: (robot, q) =>
      robot.name.toLowerCase().includes(q) || robot.slug.toLowerCase().includes(q),
    filters: FILTERS,
    sorts: SORTS,
    pageSize: 10,
  });

  async function handleToggle(robot: RobotRow) {
    setLoadingId(robot.id);
    setNotice(null);
    try {
      await toggleRobotActive(robot.id, robot.active);
      setNotice({
        kind: "ok",
        text: robot.active
          ? `${robot.name} is no longer listed on the catalog.`
          : `${robot.name} is listed on the catalog.`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to update active status",
      });
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <section className="card">
      <div className="admin-table-head">
        <div>
          <p className="card-label">Catalog</p>
          <h2 style={{ fontSize: "1.15rem", margin: 0 }}>All robots</h2>
        </div>
        <button type="button" className="btn-primary btn-sm" onClick={() => setCreating(true)}>
          Add robot
        </button>
      </div>

      {notice && (
        <p className={`admin-notice is-${notice.kind}`} role="status">
          {notice.text}
        </p>
      )}

      <TableToolbar
        view={view}
        filters={FILTERS}
        sorts={SORTS}
        searchPlaceholder="Search name or slug…"
      />

      <div className="table-wrap">
        <table className="data-table is-wide">
          <thead>
            <tr>
              <th>Robot</th>
              <th>On the catalog</th>
              <th>Pricing</th>
              <th>Source</th>
              <th>Licences</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {view.pageRows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                  {robots.length === 0 ? "No robots yet." : "No robots match those filters."}
                </td>
              </tr>
            )}
            {view.pageRows.map((robot) => {
              const isLoading = loadingId === robot.id;
              const state = storefront(robot);
              return (
                <tr key={robot.id} data-dim={robot.active ? undefined : "true"}>
                  <td data-label="Robot">
                    <span className="cell-stack">
                      <span className="robot-name">{robot.name}</span>
                      <span className="robot-slug">/robots/{robot.slug}</span>
                    </span>
                  </td>

                  <td data-label="On the catalog">
                    <span className="pill" data-tone={state.tone}>
                      {state.label}
                    </span>
                  </td>

                  <td data-label="Pricing">
                    <span className="cell-stack">
                      {robot.paidTiers > 0 ? (
                        <>
                          <span>from ${robot.cheapestPaid}</span>
                          <span className="cell-note">
                            {robot.paidTiers} paid tier{robot.paidTiers === 1 ? "" : "s"}
                            {robot.hasFreeTrial ? " · free trial" : ""}
                          </span>
                        </>
                      ) : robot.hasFreeTrial ? (
                        <>
                          <span>Free trial only</span>
                          <span className="cell-note">no paid tier active</span>
                        </>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>No active price</span>
                      )}
                    </span>
                  </td>

                  <td data-label="Source">
                    <span className="cell-stack">
                      <span>v{robot.sourceVersion}</span>
                      <span className="cell-note">used by new builds</span>
                    </span>
                  </td>

                  <td data-label="Licences">{robot.subscriptions}</td>

                  <td data-label="Actions" className="cell-actions">
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn-mini"
                        onClick={() => setEditing(robot)}
                        disabled={isLoading}
                      >
                        Edit
                      </button>
                      <UploadSourceButton robotId={robot.id} onDone={setNotice} />
                      <button
                        type="button"
                        className={`btn-mini ${robot.active ? "is-danger" : "is-go"}`}
                        onClick={() => handleToggle(robot)}
                        disabled={isLoading}
                      >
                        {isLoading ? "Saving…" : robot.active ? "Unlist" : "List"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <TablePager view={view} noun="robots" />

      <p className="admin-legend">
        <strong>Selling</strong> — listed with an active price · <strong>Coming soon</strong> —
        listed, no price, cannot be bought · <strong>Hidden</strong> — not on the catalog at all.
      </p>

      {editing && <RobotForm robot={editing} mode="edit" onClose={() => setEditing(null)} />}
      {creating && <RobotForm mode="create" onClose={() => setCreating(false)} />}
    </section>
  );
}
