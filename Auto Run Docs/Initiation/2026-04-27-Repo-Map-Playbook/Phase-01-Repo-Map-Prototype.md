# Phase 01: Repo Map Prototype

Create a repeatable, self-contained repo-map generator that scans the current Next.js app and produces a structured Mermaid Markdown map. This phase turns the existing one-off architecture scan into a working prototype: Cody can run one command, generate the map, and verify that routes, views, API handlers, services, and Prisma models are represented.

## Tasks

- [x] Establish the baseline and local rules before editing:
  - Read `AGENTS.md`, `CLAUDE.md`, `package.json`, `Auto Run Docs/repo-map-1.md`, `prisma/schema.prisma`, `src/app`, `src/lib`, and `src/config/pricing.ts`
  - Read only the relevant Next.js 16 App Router documentation under `node_modules/next/dist/docs/` before reasoning about route conventions
  - Confirm whether `node_modules` is present; if dependencies are missing, run `npm install` without asking the user
  - Reuse the existing repo-map structure and naming where it is still accurate instead of inventing a new taxonomy
  - Completion note 2026-04-27:
    - `CLAUDE.md` delegates to `AGENTS.md`; the active local rule is to read relevant Next.js docs from `node_modules/next/dist/docs/` before coding against Next conventions.
    - `node_modules` is present, so no `npm install` was required.
    - Reviewed the requested baseline files and source areas: `package.json`, `Auto Run Docs/repo-map-1.md`, `prisma/schema.prisma`, `src/app`, `src/lib`, `src/config/pricing.ts`, plus supporting `src/components`, `src/i18n`, and `src/proxy.ts` context.
    - Relevant Next.js 16 App Router docs read: `01-app/01-getting-started/02-project-structure.md`, `03-layouts-and-pages.md`, `14-metadata-and-og-images.md`, `15-route-handlers.md`, `01-app/03-api-reference/03-file-conventions/page.md`, `layout.md`, `route.md`, `dynamic-routes.md`, `src-folder.md`, `01-metadata/index.md`, `01-metadata/robots.md`, and `01-metadata/sitemap.md`.
    - Baseline taxonomy to reuse from `Auto Run Docs/repo-map-1.md`: Infrastructure Overview, Route And View Map, Main User Flows, Service And Function Dependency Map, Data Model, API Route Inventory, View Inventory, and Quick Scan Notes.
    - Current repo shape: Next.js 16.2.3 App Router under `src/app`; localized `[locale]` route tree for marketing, checkout, auth, tutorials, dashboard, and admin views; API handlers under `src/app/api`; Prisma models `User`, `Subscription`, `Order`, and `Compilation`; enums `UserRole`, `PricingTier`, `SubStatus`, `OrderStatus`, and `CompileStatus`.
    - Important baseline detail for the generator: `src/config/pricing.ts` has UI tier ids beyond the Prisma enum (`10-days`, `1-year`, `lifetime-source`), while `src/lib/subscriptions.ts` maps unknown tier ids to `ONE_MONTH`.

- [ ] Implement a deterministic repo-map generator:
  - Create `scripts/generate-repo-map.mjs` using Node built-ins and existing dependencies only
  - Scan `src/app` for localized pages, layouts, dynamic segments, metadata routes, and API `route.ts` files
  - Extract API methods from exported `GET`, `POST`, `PUT`, `PATCH`, and `DELETE` handlers
  - Scan `src/lib`, `src/components`, `src/config`, `src/i18n`, and `prisma/schema.prisma` for service modules, major exports, models, enums, and obvious external integrations
  - Generate deterministic sorted output so repeated runs only change when the repo changes

- [ ] Add runnable package scripts for the prototype:
  - Add `repo-map` to `package.json` to run `node scripts/generate-repo-map.mjs`
  - Add `repo-map:check` to regenerate into memory or a temp file and fail if required sections or Mermaid fences are missing
  - Keep script names consistent with the repository's existing npm script style

- [ ] Generate the first live architecture artifact:
  - Run `npm run repo-map`
  - Write the generated output to `Auto Run Docs/repo-map-live.md`
  - Include YAML front matter with `type: repo-map`, `title`, `created`, `tags`, and `related: ['[[al-ai-fx]]', '[[repo-map-1]]']`
  - Include Mermaid sections for infrastructure overview, route and view map, service/function dependency map, Prisma data model, API inventory, view inventory, and scan notes

- [ ] Add a focused smoke test for the generator:
  - Create a lightweight check that validates the generated Markdown has front matter, at least three Mermaid blocks, API route inventory, view inventory, and Prisma model coverage
  - Ensure the check fails with actionable messages when expected sections are missing
  - Do not add a new test framework unless the repository already has one configured

- [ ] Verify the working prototype end to end:
  - Run `npm run repo-map`
  - Run `npm run repo-map:check`
  - Run `npm run lint`
  - Fix any failures caused by this phase, then rerun the failed command until it passes
  - Open `Auto Run Docs/repo-map-live.md` and confirm it contains current routes, API handlers, services, and Prisma entities with no placeholder text
