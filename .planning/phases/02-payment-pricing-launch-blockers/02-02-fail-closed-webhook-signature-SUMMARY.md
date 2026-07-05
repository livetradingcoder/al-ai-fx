---
phase: 02-payment-pricing-launch-blockers
plan: 02
subsystem: payments-webhook
tags: [security, webhook, paygate, hmac, fail-closed, secr-01]
requires: [pricing-tiers.ts (TIER_METADATA, UnknownTierError) from Plan 02-01]
provides:
  - src/lib/webhook-signature.ts (verifyPaygateSignature, VerifyResult)
  - GET-only fail-closed Paygate webhook
  - signed create-session callback URL
affects:
  - src/app/api/webhooks/paygate/route.ts
  - src/app/api/paygate/create-session/route.ts
tech-stack:
  added: []
  patterns:
    - "Fail-closed HMAC-SHA256 verification with constant-time timingSafeEqual (length pre-check first)"
    - "Two-key dev bypass gate (NODE_ENV!=production AND explicit opt-in flag) — never single-key"
    - "Self-signed callback URLs: create-session signs, webhook verifies, payload order pinned"
requirements_closed: [SECR-01]
partial_requirements_closed: [PRIC-02]
key-files:
  created:
    - src/lib/webhook-signature.ts
    - src/lib/webhook-signature.test.ts
  modified:
    - src/app/api/webhooks/paygate/route.ts
    - src/app/api/paygate/create-session/route.ts
key_files: [src/lib/webhook-signature.ts, src/lib/webhook-signature.test.ts, src/app/api/webhooks/paygate/route.ts, src/app/api/paygate/create-session/route.ts]
deleted: [POST handler in src/app/api/webhooks/paygate/route.ts]
env_vars_added: [PAYGATE_WEBHOOK_SECRET]
decisions:
  - "Two-key dev bypass: signature verify only bypasses when NODE_ENV!=production AND PAYGATE_ALLOW_INSECURE_WEBHOOK=1 — either key alone fails closed."
  - "Dead POST handler deleted entirely: Paygate.to's WordPress + WHMCS plugin source confirms GET-only callbacks (no legitimate POST caller; also a Vercel 4.5MB body-limit hazard)."
  - "create-session fail-closes with HTTP 500 (before the Paygate wallet API call) when PAYGATE_WEBHOOK_SECRET is missing — no wasted API call, no unsigned callback."
  - "TIER_METADATA (Plan 02-01 SSoT) is the canonical tier-validity mapping in create-session, replacing the ad-hoc hasOwnProperty(PRICING_TIERS) check."
  - "Signature payload order pinned to `${orderRef}${email}${tier}${amount}` in BOTH create-session (sign) and webhook GET (verify) — drift silently breaks production callbacks."
patterns-established:
  - "verifyPaygateSignature is the single verification entry point; routes never hand-roll HMAC comparison."
duration: ~15m
completed: 2026-07-05
key-decisions:
  - two-key dev bypass
  - POST handler deleted per Paygate.to plugin source
  - create-session fail-closes on missing secret (500)
  - TIER_METADATA is the SSoT for tier validity
---

# Phase 2 Plan 02: Fail-Closed Webhook Signature Summary

Closed SECR-01 — the anonymously-provisionable fail-open Paygate webhook — by shipping a fail-closed HMAC-SHA256 `verifyPaygateSignature` helper (two-key dev bypass, constant-time `timingSafeEqual`), rewriting the webhook GET to reject on any verify failure (401) before provisioning, deleting the dead POST handler, and signing the create-session callback URL so real Paygate callbacks pass verification.

## What Shipped

- **`src/lib/webhook-signature.ts`** — `verifyPaygateSignature(payload, providedSig): VerifyResult`. Fail-closed default (`no-secret`) unless both dev-bypass keys are set. `no-signature` / `bad-length` / `bad-signature` / `ok` reason codes. Length pre-check guards `timingSafeEqual` from throwing (which would itself leak length).
- **`src/lib/webhook-signature.test.ts`** — 8 `node:test` cases with a `withEnv` snapshot/restore helper: missing-secret-prod, bypass-flag-alone-still-fails, dev-alone-still-fails, both-keys-bypass, no-signature (3 variants), bad-length, bad-signature, good-signature. All green.
- **`src/app/api/webhooks/paygate/route.ts`** — GET-only. Delegates to `verifyPaygateSignature` → 401 on any failure before any provisioning. Catches `UnknownTierError` → 400. Dead POST handler removed. `prisma` import retained (eslint-disabled) for Plan 02-03's `WebhookDelivery.create`.
- **`src/app/api/paygate/create-session/route.ts`** — Embeds HMAC `signature` query param in the registered callback URL (payload order matches the webhook exactly). Fail-closes 500 before the Paygate wallet call if the secret is missing. Tier validity now checked against `TIER_METADATA`.
- **`PAYGATE_WEBHOOK_SECRET`** — provisioned in Vercel production, preview, and development (Task 1).

## Task 1 (Checkpoint) — Resolved via CLI, No Human Action Needed

The plan marked Task 1 as `checkpoint:human-action` (provisioning a Vercel env var). Per the checkpoint automation-first rule, this was resolved without human intervention:

1. Confirmed `PAYGATE_WEBHOOK_SECRET` absent in Vercel production (matching STATE.md).
2. Generated a fresh secret via `openssl rand -hex 32` (64 hex chars).
3. Added it to all three scopes via `echo "$SECRET" | vercel env add PAYGATE_WEBHOOK_SECRET <scope>` (piped stdin — the interactive prompt accepts piped input).
4. Verified presence in production, preview, and development via `vercel env ls`.

Rollout order satisfied: the secret is in Vercel BEFORE the code merge, so create-session (signs) and webhook GET (fail-closed) will not 500 on deploy. No local `.env` files were pulled or created.

## Verification

- 8/8 signature unit tests pass (`npx tsx --test`) — Node 20.15.1 does not support `--experimental-strip-types`, so the tsx fallback was used.
- `npx tsc --noEmit` → 0 errors.
- `npx eslint` on both routes → 0 errors.
- `grep "export async function POST"` on webhook route → empty (POST deleted).
- `grep "return true"` on both webhook-signature.ts and the webhook route → empty (no fail-open path).
- `grep "hasOwnProperty"` on create-session → empty (replaced by `tier in TIER_METADATA`).
- No new npm dependencies (`git diff HEAD~3 -- package.json` empty).

## Deviations from Plan

None — plan executed as written. Two benign notes:

- **Node test runner:** Node 20.15.1 rejects `--experimental-strip-types`; used the plan's documented `npx tsx --test` fallback. Not a code deviation.
- **`return true` grep:** the helper returns `{ ok: true }` (not a bare `return true`), so the plan's "one `return true`" grep expectation returns empty rather than one line. This is the correct fail-closed shape (the single ok:true lives inside the dev-bypass guard); no code change needed.

## Notes for Downstream

- Plan 02-03 (replay/idempotency) inserts `prisma.webhookDelivery.create` + P2002 short-circuit between verify and `provisionSubscription` in the webhook GET — the `prisma` import is already wired (eslint-disabled comment marks the intent).
- Signature payload order `${orderRef}${email}${tier}${amount}` is load-bearing across create-session and the webhook — do not reorder.

## Self-Check: PASSED

- Files: all 4 key files FOUND.
- Commits: a457ce3, 23df5a3, b44b31b all FOUND.
