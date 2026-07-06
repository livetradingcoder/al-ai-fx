---
phase: 05-admin-catalog-delivery-loop
plan: 02
type: execute
wave: 2
depends_on: [05-01]
files_modified:
  - src/app/[locale]/dashboard/admin/robots/actions.ts
  - src/app/[locale]/dashboard/admin/robots/RobotForm.tsx
  - src/app/[locale]/dashboard/admin/robots/RobotsTable.tsx
autonomous: true

must_haves:
  truths:
    - "An ADMIN can create a brand-new robot from a metadata form (slug, name, shortDescription, longDescription, artworkUrl?, sortOrder), and it appears in the robot table"
    - "On create, if the admin attaches a .mq5 source file, it is encrypted + uploaded to sources/<slug>/v1.mq5.enc and the new robot keeps sourceVersion=1 (first source is v1, NOT v2)"
    - "An ADMIN can upload a NEW source version for an existing robot; it encrypts + uploads to sources/<slug>/v<current+1>.mq5.enc AND bumps Robot.sourceVersion to that number — only after the upload succeeds"
    - "Source upload reuses uploadEncryptedSource (Phase 3) — no re-implemented encryption/put; versions are immutable (allowOverwrite:false)"
    - "A duplicate slug on create is rejected with a friendly error (Prisma P2002), not a 500 stack trace"
    - "The robot edit view shows the global PRICING_TIERS read-only with a note that per-robot pricing arrives in Phase 6 (ADMN-03 scoped metadata-only)"
    - "createRobot + uploadRobotSource each enforce ADMIN inside the action; npx tsc --noEmit + eslint pass; create + both upload paths verified in a browser"
  artifacts:
    - path: "src/app/[locale]/dashboard/admin/robots/actions.ts"
      provides: "createRobot + uploadRobotSource server actions"
      contains: "uploadEncryptedSource"
    - path: "src/app/[locale]/dashboard/admin/robots/RobotForm.tsx"
      provides: "Create mode + source-upload file input + read-only pricing display"
      contains: "createRobot"
  key_links:
    - from: "src/app/[locale]/dashboard/admin/robots/actions.ts"
      to: "src/lib/source-storage.ts uploadEncryptedSource"
      via: "encrypts + uploads versioned source"
      pattern: "uploadEncryptedSource\\("
    - from: "src/app/[locale]/dashboard/admin/robots/actions.ts"
      to: "prisma.robot"
      via: "create + sourceVersion bump"
      pattern: "prisma\\.robot\\.(create|update)"
    - from: "src/app/[locale]/dashboard/admin/robots/RobotForm.tsx"
      to: "src/app/[locale]/dashboard/admin/robots/actions.ts createRobot"
      via: "create-mode submit"
      pattern: "createRobot"
---

<objective>
Extend the admin robot surface (from Plan 05-01) with **onboarding a new robot without a deploy** (ADMN-02) and **uploading an encrypted source version** (ADMN-04), reusing the Phase 3 `uploadEncryptedSource`/`encryptSource` helpers. Also satisfy ADMN-03 as **metadata-only** by rendering the existing global pricing tiers read-only on the edit view with a "per-robot pricing arrives in Phase 6" note.

Purpose: Satisfies success criterion 2 ("Admin can add a new robot + upload encrypted source version — gated ADMIN role") and the scoped ADMN-03.

**First-source semantics (Pitfall 3 — locked decision):** a new robot defaults `sourceVersion:1`. If the create form includes a source file, upload it to **v1** and leave `sourceVersion=1`. Subsequent uploads for an existing robot compute `nextVersion = sourceVersion + 1`, upload to that path, then bump. A robot with no uploaded source stays effectively non-compilable — the admin activates it only after uploading. Document this explicitly.

**Depends on Plan 05-01** for the `robots/` directory (page, table, form, actions) — this plan APPENDS to `actions.ts` and extends `RobotForm.tsx`/`RobotsTable.tsx` (shared files → Wave 2, sequential after 05-01).

Output:
- `robots/actions.ts` — adds `createRobot` + `uploadRobotSource`
- `robots/RobotForm.tsx` — adds create mode, source-upload file input, read-only pricing panel
- `robots/RobotsTable.tsx` — adds an "Add Robot" entry point + a per-row "Upload Source" trigger
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
@.planning/phases/05-admin-catalog-delivery-loop/05-01-SUMMARY.md
@src/app/[locale]/dashboard/admin/robots/actions.ts
@src/app/[locale]/dashboard/admin/robots/RobotForm.tsx
@src/app/[locale]/dashboard/admin/robots/RobotsTable.tsx
@src/lib/source-storage.ts
@src/config/pricing.ts
@src/lib/pricing-tiers.ts
@prisma/schema.prisma
@AGENTS.md
</context>

<critical_environment_notes>
- **Node:** prepend `export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"` for every node/npx/tsc/eslint/dev call.
- **Reuse, do NOT re-implement:** `uploadEncryptedSource(robotSlug, version, buf)` from `src/lib/source-storage.ts` already handles AES-256-GCM encryption, the immutable `sources/<slug>/v<N>.mq5.enc` pathname, and `access:"private"`. Never hand-roll `put()`/encryption.
- **Version immutability:** `uploadEncryptedSource` uses `allowOverwrite:false`. Uploading to an existing version path throws — always upload to a NEW version. Order matters: upload FIRST, then persist the `sourceVersion` bump (so a failed upload never leaves a bump pointing at a missing blob).
- **Server Action file upload / body limit (Pitfall 5):** MQL5 `.mq5` sources are a few KB — well under the 1MB Server-Action body limit, so a `FormData` file field is fine; no config change. Read the file as `Buffer.from(await file.arrayBuffer())`.
- **slug immutability (Pitfall 4):** slug is settable ONLY on create; never on edit/upload. Enforce `@unique` — catch Prisma `P2002` and return a friendly "slug already exists" error.
- **Next 16:** `"use server"` actions are POST-reachable — role check inside each new action.
- **ADMN-03 scope:** metadata-only. Do NOT create any `RobotPricing`/`RobotTier` table or schema change. Render `PRICING_TIERS` (from `src/config/pricing.ts`) read-only.
</critical_environment_notes>

<tasks>

<task type="auto">
  <name>Task 1: Append createRobot + uploadRobotSource server actions</name>
  <files>src/app/[locale]/dashboard/admin/robots/actions.ts</files>
  <action>
Append two new exports to the existing `robots/actions.ts` (keep `toggleRobotActive`/`updateRobot` from 05-01 untouched). Both use `FormData` so a file can ride along.

Add the import at the top:
```ts
import { uploadEncryptedSource } from "@/lib/source-storage";
import { Prisma } from "@prisma/client";
```

**1a. `createRobot(formData: FormData)`** — role gate → read metadata fields → create the Robot (sourceVersion defaults to 1) → if a source file is present, upload it to **v1** (first-source semantics). Catch P2002 on slug.
```ts
export async function createRobot(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

  const slug = String(formData.get("slug") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const shortDescription = String(formData.get("shortDescription") || "").trim();
  const longDescription = String(formData.get("longDescription") || "").trim();
  const artworkUrlRaw = String(formData.get("artworkUrl") || "").trim();
  const sortOrder = Math.trunc(Number(formData.get("sortOrder") || 0));

  if (!slug || !name || !shortDescription) {
    throw new Error("Slug, name, and short description are required");
  }
  // slug shape guard: lowercase kebab (join key for Blob path)
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error("Slug must be lowercase letters, numbers, and hyphens only");
  }

  let robot;
  try {
    robot = await prisma.robot.create({
      data: {
        slug, name, shortDescription,
        longDescription: longDescription || shortDescription,
        artworkUrl: artworkUrlRaw || null,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
        active: false, // new robots start inactive until a source is uploaded + reviewed
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`A robot with slug "${slug}" already exists`);
    }
    throw e;
  }

  // Optional first source → upload to v1, leave sourceVersion=1 (first-source semantics).
  const file = formData.get("source");
  if (file instanceof File && file.size > 0) {
    const buf = Buffer.from(await file.arrayBuffer());
    await uploadEncryptedSource(robot.slug, 1, buf); // sources/<slug>/v1.mq5.enc
  }

  revalidatePath("/dashboard/admin/robots");
  return { success: true, id: robot.id };
}
```

**1b. `uploadRobotSource(formData: FormData)`** — role gate → look up robot → compute `nextVersion = sourceVersion + 1` → upload → bump. Upload before bump.
```ts
export async function uploadRobotSource(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

  const robotId = String(formData.get("robotId") || "");
  const file = formData.get("source");
  if (!(file instanceof File) || file.size === 0) throw new Error("A .mq5 source file is required");

  const robot = await prisma.robot.findUniqueOrThrow({ where: { id: robotId } });
  const nextVersion = robot.sourceVersion + 1;
  const buf = Buffer.from(await file.arrayBuffer());

  // Upload FIRST (immutable put to a NEW version path) — only bump after it succeeds,
  // so a failed upload never leaves sourceVersion pointing at a missing blob.
  await uploadEncryptedSource(robot.slug, nextVersion, buf);
  await prisma.robot.update({ where: { id: robotId }, data: { sourceVersion: nextVersion } });

  revalidatePath("/dashboard/admin/robots");
  return { success: true, version: nextVersion };
}
```
Do NOT accept/write `slug` in either action's UPDATE path (create sets it once; upload never changes it).
  </action>
  <verify>
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"; cd /Users/klev/Code/al-ai-fx
grep -q 'export async function createRobot' "src/app/[locale]/dashboard/admin/robots/actions.ts" && echo CREATE_OK
grep -q 'export async function uploadRobotSource' "src/app/[locale]/dashboard/admin/robots/actions.ts" && echo UPLOAD_OK
grep -q 'uploadEncryptedSource(robot.slug, 1, buf)' "src/app/[locale]/dashboard/admin/robots/actions.ts" && echo FIRST_SOURCE_V1_OK
grep -q 'robot.sourceVersion + 1' "src/app/[locale]/dashboard/admin/robots/actions.ts" && echo BUMP_OK
grep -q 'P2002' "src/app/[locale]/dashboard/admin/robots/actions.ts" && echo DUP_SLUG_OK
# upload must precede bump — uploadEncryptedSource line before the sourceVersion update line:
awk '/uploadEncryptedSource\(robot.slug, nextVersion/{u=NR} /data: \{ sourceVersion: nextVersion \}/{b=NR} END{ if (u>0 && b>u) print "ORDER_OK" }' "src/app/[locale]/dashboard/admin/robots/actions.ts"
# still 4 role gates total (toggle, update, create, upload):
test "$(grep -c 'session?.user?.role !== "ADMIN"' "src/app/[locale]/dashboard/admin/robots/actions.ts")" -ge 4 && echo ALL_GATES_OK
npx tsc --noEmit && npx eslint "src/app/[locale]/dashboard/admin/robots/actions.ts"
```
  </verify>
  <done>`createRobot` (first source → v1, sourceVersion stays 1, P2002 → friendly error) + `uploadRobotSource` (nextVersion = current+1, upload-then-bump) exist, both ADMIN-gated, reusing `uploadEncryptedSource`; tsc + eslint clean.</done>
</task>

<task type="auto">
  <name>Task 2: RobotForm create mode + source upload input + read-only pricing; table entry points</name>
  <files>src/app/[locale]/dashboard/admin/robots/RobotForm.tsx, src/app/[locale]/dashboard/admin/robots/RobotsTable.tsx</files>
  <action>
**2a. `RobotForm.tsx`** — support two modes: `mode="create"` (no `robot` prop) and `mode="edit"` (existing `robot`, from 05-01).
  - In **create mode**: enable the `slug` input (editable, required, with caption "Permanent — lowercase kebab; becomes the Blob path"), plus name/short/long/artworkUrl/sortOrder, plus a `<input type="file" name="source" accept=".mq5" />` (optional first source). Submit builds a `FormData` from the fields + file and calls `await createRobot(fd)`; on success `onClose()`. Since the action takes `FormData`, either use an uncontrolled `<form action={createRobot}>` OR build the FormData manually in an onSubmit — pick the uncontrolled `<form action={...}>` approach if it fits the app's convention, else manual FormData in a try/catch (surface errors via `alert` like `UsersTable`).
  - In **edit mode**: keep the 05-01 behavior (metadata-only via `updateRobot`, slug disabled). ADD a **read-only pricing panel** below the fields: map over `PRICING_TIERS` (import from `@/config/pricing`) rendering each tier's label + price as static text, with a note: "Pricing is global for now. Per-robot pricing arrives in the catalog phase (Phase 6)." This satisfies ADMN-03 metadata-only.
  Import `{ createRobot, updateRobot } from "./actions"` and `{ PRICING_TIERS } from "@/config/pricing"`. (Confirm the exact export name/shape of `PRICING_TIERS` by reading `src/config/pricing.ts`; render defensively — label + formatted price only.)

**2b. `RobotsTable.tsx`** — add:
  - An "Add Robot" button above the table that opens `<RobotForm mode="create" onClose={...} />`.
  - A per-row "Upload Source" control: a small inline form/file-input that calls `uploadRobotSource(fd)` with a hidden `robotId`, OR a button that opens a mini upload panel. On success, re-render (revalidated data shows the bumped `sourceVersion`). Import `{ uploadRobotSource } from "./actions"`. Show `sourceVersion` in the row so the bump is visible after upload.
  Keep the existing toggle + edit controls from 05-01 intact.
  </action>
  <verify>
```bash
export PATH="/Users/klev/.nvm/versions/node/v20.15.1/bin:$PATH"; cd /Users/klev/Code/al-ai-fx
grep -q 'createRobot' "src/app/[locale]/dashboard/admin/robots/RobotForm.tsx" && echo CREATE_WIRED_OK
grep -q 'type="file"' "src/app/[locale]/dashboard/admin/robots/RobotForm.tsx" && echo FILE_INPUT_OK
grep -q 'PRICING_TIERS' "src/app/[locale]/dashboard/admin/robots/RobotForm.tsx" && echo PRICING_READONLY_OK
grep -q 'Phase 6' "src/app/[locale]/dashboard/admin/robots/RobotForm.tsx" && echo PRICING_NOTE_OK
grep -q 'uploadRobotSource' "src/app/[locale]/dashboard/admin/robots/RobotsTable.tsx" && echo UPLOAD_WIRED_OK
npx tsc --noEmit && npx eslint "src/app/[locale]/dashboard/admin/robots/RobotForm.tsx" "src/app/[locale]/dashboard/admin/robots/RobotsTable.tsx"
```
  </verify>
  <done>Form has a create mode (slug editable + optional .mq5 file → createRobot) and edit mode (metadata + read-only global pricing panel with Phase-6 note); table has Add Robot + per-row Upload Source (→ uploadRobotSource) and shows sourceVersion; tsc + eslint clean.</done>
</task>

<task type="auto">
  <name>Task 3: Browser verification (create, first-source v1, version bump, dup slug)</name>
  <files>.claude/launch.json</files>
  <action>
Verify onboarding + source upload end-to-end via the preview workflow (admin session, dev server from `.claude/launch.json` "web" config — reuse or create as in 05-01).

1. Start the dev server (`preview_start`), log in as ADMIN, go to `/dashboard/admin/robots`.
2. Click "Add Robot", fill slug `testbot-<rand>`, name, shortDescription, sortOrder; attach a tiny valid-ish `.mq5` file (create a small text file with `.mq5` extension in the scratchpad and upload it via `preview_fill`/file input). Submit. Confirm the new robot appears in the table with `sourceVersion` = 1 (first source → v1, NOT 2).
3. Verify the v1 blob exists: run a Node one-liner or `vercel blob` check that `sources/testbot-<rand>/v1.mq5.enc` was created (or, if blob-list tooling is awkward, confirm via a follow-up compile-source fetch path / server log). At minimum assert the row's sourceVersion=1 and no error was thrown.
4. On that robot's row, use "Upload Source" to upload a second `.mq5`; confirm `sourceVersion` becomes 2 in the table (bump only after upload succeeded).
5. Duplicate-slug: try "Add Robot" again with the SAME slug; confirm a friendly "already exists" alert appears (not a 500 / stack trace).
6. Open the robot's Edit view; confirm the read-only PRICING_TIERS panel renders with the "Phase 6" note.
7. Role gate: confirm a non-admin cannot reach the page (redirect) — a direct action POST as non-admin throws (already covered by 05-01's gate; spot-check one).
Capture a `preview_screenshot` of the create form and of a post-upload table row for the SUMMARY.
  </action>
  <verify>
- New robot created via form appears in table with sourceVersion=1 when a first source is attached.
- Uploading another source bumps sourceVersion to 2.
- Duplicate slug shows a friendly error, not a crash.
- Edit view shows read-only global pricing + Phase-6 note.
  </verify>
  <done>Create-with-first-source lands at v1, subsequent upload bumps to v2, duplicate slug is friendly-rejected, and the read-only pricing panel renders — all confirmed via preview tools with screenshots captured.</done>
</task>

</tasks>

<verification>
- `createRobot` onboards a new robot (ADMIN-gated); optional first source → `sources/<slug>/v1.mq5.enc`, sourceVersion stays 1.
- `uploadRobotSource` uploads to `v<current+1>` then bumps sourceVersion (upload-before-bump ordering).
- Both reuse `uploadEncryptedSource` (no re-implemented crypto/put); versions immutable.
- Duplicate slug → friendly P2002 error.
- Edit view shows read-only global `PRICING_TIERS` + "per-robot pricing in Phase 6" note (ADMN-03 metadata-only).
- `npx tsc --noEmit` + `npx eslint` clean; browser verification passed.
</verification>

<success_criteria>
- ADMN-02: Admin onboards a new robot (metadata form) without a deploy.
- ADMN-04: Admin uploads an encrypted source version (reusing Phase 3 helper); sourceVersion bumps correctly; first source is v1.
- ADMN-03 (scoped): pricing shown read-only, deferred to Phase 6 — documented.
- Phase success criterion 2 met and verified in a browser.
</success_criteria>

<output>
After completion, create `.planning/phases/05-admin-catalog-delivery-loop/05-02-SUMMARY.md` with frontmatter: `phase`, `plan`, `status: complete`, `requirements: [ADMN-02, ADMN-03, ADMN-04]`, `files_changed`, `commits`, `key_decisions` (first-source-uploads-to-v1 / later uploads +1; upload-before-bump ordering; new robots start active:false; slug lowercase-kebab validated + immutable; P2002 → friendly error; ADMN-03 scoped metadata-only, per-robot pricing deferred to Phase 6), and `provides` — note the encrypted-source layout `sources/<slug>/v<N>.mq5.enc` is now admin-writable and that the compile pipeline (Phase 4) fetches whatever `sourceVersion` the robot row points at.
</output>
