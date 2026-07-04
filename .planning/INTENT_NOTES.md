# Intent Notes — Pre-Init

Captured during /gsd:new-project questioning. Feeds PROJECT.md after /gsd:map-codebase completes.

## User's Goals (Milestone Scope)

1. **Compile server reliability** — Windows compile server is CURRENTLY OFFLINE / NOT REACHABLE. Must be brought online, kept online, and made to deliver compiled robot automatically after payment.
2. **Multi-robot support** — Extend platform to compile different robots based on user's choice at checkout.
3. **Add new robots** — User has source code for 3+ new MQL5 robots to add to catalog.

## Answers Locked

| Question | Answer |
|---|---|
| Server state | Not reachable / offline |
| Robot selection UX | One catalog + selector on checkout |
| Robot count / platform | 3+ new robots, MQL5 source (MT5) |
| Existing platform | GoldBot (single robot, hardcoded in `src/app/api/compiler/complete/route.ts`) |

## Blockers Already Identified in Code

- `Compilation` model in `prisma/schema.prisma` has no `robotId` / `productType` field — schema change required for multi-robot.
- Compiled filename hardcoded: `AL-ai-FX_GoldBot_${jobId}.ex5` in `src/app/api/compiler/complete/route.ts`.
- Poll endpoint returns only `mt5AccountNumber` + `expiresAt` — must also return chosen robot type for Windows server to pick correct source template.
- Windows compile server code not in repo (external). Auth: `COMPILER_SECRET` bearer token.

## Stack Snapshot

Next.js 16.2, React 19.2, Prisma 6 + Postgres, NextAuth v4, Vercel Blob, Mailtrap, Paygate (payments), next-intl (7 locales: en/es/de/ar/hi/bn/ur), TailwindCSS 4, framer-motion, TypeScript.
