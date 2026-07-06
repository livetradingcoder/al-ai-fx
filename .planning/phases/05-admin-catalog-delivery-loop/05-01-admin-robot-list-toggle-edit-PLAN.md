---
phase: 05-admin-catalog-delivery-loop
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/[locale]/dashboard/admin/robots/page.tsx
  - src/app/[locale]/dashboard/admin/robots/actions.ts
  - src/app/[locale]/dashboard/admin/robots/RobotsTable.tsx
  - src/app/[locale]/dashboard/admin/robots/RobotForm.tsx
  - src/components/dashboard/DashboardSidebar.tsx
autonomous: true

must_haves:
  truths:
    - "An ADMIN visiting /dashboard/admin/robots sees a table of every Robot (all robots, active AND inactive) with slug, name, active state, sortOrder, sourceVersion"
    - "An ADMIN can flip a robot active <-> inactive from the table; the change persists in Postgres and the table reflects it after revalidation"
    - "An ADMIN can open an edit form for a robot and update name, shortDescription, longDescription, artworkUrl, sortOrder — and the change persists"
    - "The slug field is NOT editable on the edit form (create-only, immutable — it is the Blob path + compiled-filename join key)"
    - "A non-ADMIN hitting /dashboard/admin/robots is redirected to /dashboard; a non-ADMIN POST directly to any server action throws Unauthorized (role check inside every action, not just the page)"
    - "The admin sidebar has a Manage Robots link pointing at /dashboard/admin/robots"
    - "npx tsc --noEmit and npx eslint pass; the page renders and the toggle+edit work in a browser"
  artifacts:
    - path: "src/app/[locale]/dashboard/admin/robots/page.tsx"
      provides: "Server-Component role-gated robot list"
      contains: "prisma.robot.findMany"
    - path: "src/app/[locale]/dashboard/admin/robots/actions.ts"
      provides: "toggleRobotActive + updateRobot server actions with per-action role gate"
      contains: "session?.user?.role !== \"ADMIN\""
    - path: "src/app/[locale]/dashboard/admin/robots/RobotsTable.tsx"
      provides: "Client table with active toggle + edit trigger"
      contains: "toggleRobotActive"
    - path: "src/app/[locale]/dashboard/admin/robots/RobotForm.tsx"
      provides: "Client edit form (metadata) — slug disabled"
      contains: "updateRobot"
    - path: "src/components/dashboard/DashboardSidebar.tsx"
      provides: "Manage Robots admin nav link"
      contains: "/dashboard/admin/robots"
  key_links:
    - from: "src/app/[locale]/dashboard/admin/robots/RobotsTable.tsx"
      to: "src/app/[locale]/dashboard/admin/robots/actions.ts toggleRobotActive"
      via: "onClick calls server action"
      pattern: "toggleRobotActive"
    - from: "src/app/[locale]/dashboard/admin/robots/actions.ts"
      to: "prisma.robot"
      via: "update mutation + revalidatePath"
      pattern: "prisma\\.robot\\.update"
    - from: "src/app/[locale]/dashboard/admin/robots/page.tsx"
      to: "prisma.robot"
      via: "findMany all robots"
      pattern: "prisma\\.robot\\.findMany"
---

<objective>
Build the admin robot catalog list + toggle + edit surface (ADMN-01, ADMN-02 metadata-edit half, ADMN-05 role gate) by copying the proven `dashboard/admin/users/` CRUD trio verbatim onto the `Robot` resource. An admin can list every robot, flip active/inactive, and edit metadata — with NO deploy and NO DB console.

Purpose: Satisfies success criterion 1 ("Admin can list all robots, toggle active/inactive, edit metadata ... from /dashboard/admin — no deploy/DB console") and the role-gate half of criterion 2 / ADMN-05.

Scope note (documented per phase research Open Question 1): **pricing is metadata-only this phase**. Do NOT add a per-robot pricing table — that is Phase 6 (PRIC-01). This plan handles the metadata fields only. The read-only global-pricing display note is handled in Plan 05-02's edit form; this plan is list + toggle + metadata-edit.

Output:
- `src/app/[locale]/dashboard/admin/robots/page.tsx` — server, role-gated, `prisma.robot.findMany`
- `src/app/[locale]/dashboard/admin/robots/actions.ts` — `"use server"` `toggleRobotActive` + `updateRobot`
- `src/app/[locale]/dashboard/admin/robots/RobotsTable.tsx` — `"use client"` list + toggle + edit trigger
- `src/app/[locale]/dashboard/admin/robots/RobotForm.tsx` — `"use client"` metadata edit form (slug disabled)
- `src/components/dashboard/DashboardSidebar.tsx` — Manage Robots link
</objective>

<execution_context>
@/Users/klev/.claude/get-shit-done/workflows/execute-plan.md
@/Users/klev/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/05-admin-catalog-delivery-loop/5-RESEARCH.md
@src/app/[locale]/dashboard/admin/users/page.tsx
@src/app/[locale]/dashboard/admin/users/actions.ts
@src/app/[locale]/dashboard/admin/users/UsersTable.tsx
@src/components/dashboard/DashboardSidebar.tsx
@prisma/schema.prisma
@AGENTS.md
</context>

<critical_environment_notes>
- **Node:** prepend `export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"` for every node/npx/tsc/eslint/dev call (default `node` is broken v11).
- **No schema migration in this phase.** The `Robot` model already has every field needed (slug, name, shortDescription, longDescription, active, artworkUrl?, sortOrder, sourceVersion). Do NOT touch `prisma/schema.prisma`.
- **Next.js 16 (NOT the Next.js you know — see AGENTS.md):** Server Actions are stable & on by default (no experimental flag). `"use server"` files export actions that are **directly POST-reachable** — the role check MUST live inside every action, exactly like `users/actions.ts`. Use `revalidatePath` from `next/cache` (the app's proven pattern). `redirect` from `next/navigation`.
- **slug is create-only / immutable** (Pitfall 4): it is the Blob-path + compiled-filename join key. The edit form must render slug read-only/disabled and `updateRobot` must NOT accept or write `slug`.
- **File layout:** these files live under `src/app/[locale]/dashboard/admin/robots/` (note the `[locale]` segment) — mirror the exact location of `users/`.
- **Styling:** copy the inline-style + `admin-container` / table conventions from `UsersTable.tsx` for visual consistency; do not introduce a new CSS system.
</critical_environment_notes>

<tasks>

<task type="auto">
  <name>Task 1: Server page + server actions (list, toggle, metadata edit)</name>
  <files>src/app/[locale]/dashboard/admin/robots/page.tsx, src/app/[locale]/dashboard/admin/robots/actions.ts</files>
  <action>
**1a. `page.tsx`** — copy the shape of `users/page.tsx`:
```tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import RobotsTable from "./RobotsTable";

export default async function AdminRobotsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session?.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }
  const robots = await prisma.robot.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div className="admin-container">
        <h1 style={{ fontSize: "2.5rem", marginBottom: "3rem" }}>Robot Catalog</h1>
        <RobotsTable robots={robots} />
      </div>
    </div>
  );
}
```
`findMany` with NO `where` filter — the admin must see inactive robots too (this is the management surface, not the public catalog).

**1b. `actions.ts`** — `"use server"`, one role gate per export (copy `users/actions.ts` exactly):
```ts
"use server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function toggleRobotActive(robotId: string, currentActive: boolean) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");
  await prisma.robot.update({ where: { id: robotId }, data: { active: !currentActive } });
  revalidatePath("/dashboard/admin/robots");
  return { success: true };
}

export async function updateRobot(robotId: string, data: {
  name: string;
  shortDescription: string;
  longDescription: string;
  artworkUrl: string;
  sortOrder: number;
}) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");
  const name = data.name?.trim();
  const shortDescription = data.shortDescription?.trim();
  if (!name || !shortDescription) throw new Error("Name and short description are required");
  await prisma.robot.update({
    where: { id: robotId },
    data: {
      name,
      shortDescription,
      longDescription: data.longDescription ?? "",
      // artworkUrl is nullable — store null when blank, never "" masquerading as a URL
      artworkUrl: data.artworkUrl?.trim() ? data.artworkUrl.trim() : null,
      sortOrder: Number.isFinite(data.sortOrder) ? Math.trunc(data.sortOrder) : 0,
    },
  });
  revalidatePath("/dashboard/admin/robots");
  return { success: true };
}
```
CRITICAL: `updateRobot` MUST NOT accept or write `slug` or `sourceVersion` (slug is immutable; sourceVersion is bumped only by the upload action in Plan 05-02). Do NOT add `createRobot`/`uploadRobotSource` here — those belong to Plan 05-02 (which appends to this same file).
  </action>
  <verify>
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"; cd /Users/klev/Code/al-ai-fx
grep -q 'prisma.robot.findMany' "src/app/[locale]/dashboard/admin/robots/page.tsx" && echo PAGE_OK
grep -q 'redirect("/dashboard")' "src/app/[locale]/dashboard/admin/robots/page.tsx" && echo GATE_OK
# Every action re-checks role (expect 2 matches: toggle + update):
test "$(grep -c 'session?.user?.role !== "ADMIN"' "src/app/[locale]/dashboard/admin/robots/actions.ts")" -ge 2 && echo ACTION_GATE_OK
# slug must NOT be written in update:
! grep -q 'slug' "src/app/[locale]/dashboard/admin/robots/actions.ts" && echo SLUG_IMMUTABLE_OK
grep -q 'revalidatePath("/dashboard/admin/robots")' "src/app/[locale]/dashboard/admin/robots/actions.ts" && echo REVALIDATE_OK
npx tsc --noEmit
```
  </verify>
  <done>Server page lists ALL robots (role-gated → redirect); `toggleRobotActive` + `updateRobot` each re-check ADMIN inside the action, mutate, and revalidate; slug/sourceVersion never written by update; tsc clean.</done>
</task>

<task type="auto">
  <name>Task 2: Client table + metadata edit form + sidebar link</name>
  <files>src/app/[locale]/dashboard/admin/robots/RobotsTable.tsx, src/app/[locale]/dashboard/admin/robots/RobotForm.tsx, src/components/dashboard/DashboardSidebar.tsx</files>
  <action>
**2a. `RobotsTable.tsx`** — `"use client"`, mirror `UsersTable.tsx` (useState loadingId, try/catch → alert, inline styles). A `Robot` row type with `id, slug, name, shortDescription, longDescription, active, artworkUrl, sortOrder, sourceVersion`. Render a table: columns slug, name, active badge, sortOrder, sourceVersion, actions. Actions per row:
  - A toggle button ("Deactivate" if active, "Activate" if not) → `handleToggle(robot.id, robot.active)` → `await toggleRobotActive(...)` inside try/catch with `setLoadingId`.
  - An "Edit" button that opens `<RobotForm robot={selected} onClose={...} />` (control an editing-robot state in the table; render the form inline or in a simple modal-ish panel).
Import `{ toggleRobotActive } from "./actions"`. Use the same `getErrorMessage` helper as `UsersTable`.

**2b. `RobotForm.tsx`** — `"use client"`, controlled form seeded from the passed `robot`. Fields:
  - `slug` — rendered as a **disabled** text input (value = robot.slug) with a caption "Slug is permanent (source/download join key)". It is display-only; not submitted.
  - `name` (text, required), `shortDescription` (text/textarea, required), `longDescription` (textarea), `artworkUrl` (text, optional), `sortOrder` (number).
  - Submit handler calls `await updateRobot(robot.id, { name, shortDescription, longDescription, artworkUrl, sortOrder: Number(sortOrder) })` in try/catch, on success calls `onClose()` (parent re-renders from revalidated server data). Use `useTransition` or a local `saving` boolean for pending UI.
Import `{ updateRobot } from "./actions"`. Type the props: `{ robot: RobotRow; onClose: () => void }`.
Keep this form edit-only for now; Plan 05-02 extends it with a create mode + a source-upload input.

**2c. `DashboardSidebar.tsx`** — add a nav `<li>` in the admin section (after the "Manage Users" link, lines ~112-119) pointing at `/dashboard/admin/robots`:
```tsx
<li>
  <Link
    href="/dashboard/admin/robots"
    style={getLinkStyle(isActive("/dashboard/admin/robots"), "primary")}
  >
    Manage Robots &rarr;
  </Link>
</li>
```
(Use a plain label "Manage Robots" — do not require a new i18n key; the existing links use `t(...)` but a literal is acceptable here to avoid touching message catalogs. If eslint/i18n lint complains, add the string literal directly.)
  </action>
  <verify>
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"; cd /Users/klev/Code/al-ai-fx
grep -q '"use client"' "src/app/[locale]/dashboard/admin/robots/RobotsTable.tsx" && echo CLIENT_OK
grep -q 'toggleRobotActive' "src/app/[locale]/dashboard/admin/robots/RobotsTable.tsx" && echo TOGGLE_WIRED_OK
grep -q 'updateRobot' "src/app/[locale]/dashboard/admin/robots/RobotForm.tsx" && echo EDIT_WIRED_OK
grep -q 'disabled' "src/app/[locale]/dashboard/admin/robots/RobotForm.tsx" && echo SLUG_DISABLED_OK
grep -q '/dashboard/admin/robots' src/components/dashboard/DashboardSidebar.tsx && echo SIDEBAR_OK
npx tsc --noEmit && npx eslint "src/app/[locale]/dashboard/admin/robots/RobotsTable.tsx" "src/app/[locale]/dashboard/admin/robots/RobotForm.tsx" src/components/dashboard/DashboardSidebar.tsx
```
  </verify>
  <done>Client table renders robots with a working active toggle + edit trigger; edit form updates metadata with slug shown-but-disabled; sidebar has Manage Robots link; tsc + eslint clean.</done>
</task>

<task type="auto">
  <name>Task 3: Browser verification (list, toggle, edit, role gate)</name>
  <files>.claude/launch.json</files>
  <action>
Verify the admin robot surface actually works in a browser using the preview workflow (this is UI work — tsc/eslint alone is insufficient per project norms).

1. Ensure a dev-server launch config exists in `.claude/launch.json` (create it if absent) with the Next dev server, e.g. name `"web"`, `runtimeExecutable` `/Users/klev/.nvm/versions/node/v20.15.1/bin/npm`, `runtimeArgs` `["run","dev"]`, and the project's dev port. Start it with `preview_start`.
2. Log in as an ADMIN account (the founder/admin session used in prior phases) and navigate to `/dashboard/admin/robots`. Use `preview_snapshot` to confirm the table lists the seeded robot(s) (GoldBot) including inactive ones, showing slug + active state + sourceVersion.
3. `preview_click` the active-toggle button; re-`preview_snapshot` (or `preview_screenshot`) and confirm the active badge flipped and persisted (reload — state holds because it is DB-backed + revalidated).
4. `preview_click` Edit on a robot, change `sortOrder` and `shortDescription` via `preview_fill`, submit, and confirm the table reflects the new values after the form closes.
5. Confirm the slug input in the edit form is disabled (cannot be changed).
6. Role gate: from a NON-admin session (or logged out), navigate to `/dashboard/admin/robots` and confirm redirect to `/dashboard` (snapshot shows the normal dashboard, not the robot table).
Capture at least one `preview_screenshot` of the working table for the SUMMARY.
  </action>
  <verify>
- `preview_snapshot` of `/dashboard/admin/robots` shows the robot table with toggle + edit controls (admin session).
- Toggling active flips the badge and survives a reload.
- Editing metadata (sortOrder/shortDescription) persists and shows in the table.
- Slug field is disabled in the edit form.
- Non-admin is redirected to `/dashboard`.
  </verify>
  <done>The robot list renders, active-toggle persists, metadata edit persists, slug is non-editable, and non-admins are redirected — all confirmed via preview tools with a screenshot captured.</done>
</task>

</tasks>

<verification>
- `/dashboard/admin/robots` renders a role-gated table of ALL robots (active + inactive).
- `toggleRobotActive` + `updateRobot` each re-check `role === "ADMIN"` inside the action (direct-POST safe) and `revalidatePath("/dashboard/admin/robots")`.
- Edit form updates name/short/long/artworkUrl/sortOrder; slug is disabled and never written; sourceVersion untouched.
- Sidebar links to `/dashboard/admin/robots`.
- Non-admin → redirect on the page.
- `npx tsc --noEmit` + `npx eslint` clean; browser verification passed.
</verification>

<success_criteria>
- ADMN-01: Admin lists all robots and toggles active/inactive without a deploy or DB console.
- ADMN-02 (metadata-edit half): Admin edits robot metadata from the dashboard.
- ADMN-05 (gate half): every mutating action enforces ADMIN inside the action, not just the page.
- Phase success criterion 1 met and verified in a browser.
</success_criteria>

<output>
After completion, create `.planning/phases/05-admin-catalog-delivery-loop/05-01-SUMMARY.md` with frontmatter: `phase`, `plan`, `status: complete`, `requirements: [ADMN-01, ADMN-02, ADMN-05]`, `files_changed`, `commits`, `key_decisions` (slug rendered-but-disabled on edit / immutable; findMany with no where so inactive robots show; role gate inside every action; metadata-only scope — no pricing table), and `provides` — document that `robots/actions.ts` now exports `toggleRobotActive` + `updateRobot`, and that Plan 05-02 APPENDS `createRobot` + `uploadRobotSource` to this same file and extends `RobotForm.tsx` with a create mode + source-upload input (note the shared files so 05-02 sequences after this plan).
</output>
