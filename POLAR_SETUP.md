# Polar setup — al-ai-fx

Polar organization: **algo-trading-school** (`7b8bd3a1-1ac4-494f-a125-ab40c0e5d7ee`), **production** server.
The org is shared with algotradingschool (`/api/webhook/polar`); each app has its own webhook endpoint and signing secret.

## Code

| File | Purpose |
|---|---|
| `src/lib/polar.ts` | Lazily created Polar client (`@polar-sh/sdk/2026-10`) |
| `src/app/api/webhooks/polar/route.ts` | Webhook receiver — verifies the signature, then handles `order.paid` / `customer.state_changed` (handlers are TODO) |
| `src/app/api/checkout/polar/route.ts` | `GET /api/checkout/polar?products=<id>` → redirects to Polar hosted checkout |

## Environment variables

Set these in **Vercel → al-ai-fx project → Settings → Environment Variables (Production)**, then redeploy:

| Name | Value |
|---|---|
| `POLAR_ACCESS_TOKEN` | Organization access token (`polar_oat_…`) |
| `POLAR_WEBHOOK_SECRET` | Signing secret of this app's webhook endpoint (below) |
| `POLAR_SERVER` | `production` (default; `sandbox` only for testing against sandbox.polar.sh) |

Never commit these. The secret is not in this file: during setup it was written to the gitignored
`.env.local` of the setup machine only. To get it again, open Polar → Settings → Webhooks → this
endpoint, where it can be viewed or regenerated (update the env var after regenerating).

## Resources created in Polar

| Resource | ID | Details |
|---|---|---|
| Product "Test Product" | `43d42d45-6a3c-44bc-9939-461993908fc2` | $10.00 USD, one-time |
| Webhook endpoint | `44407786-898b-4786-9538-30a8c36970a4` | `https://www.al-ai-fx.xyz/api/webhooks/polar`, format `raw`, 23 events |
| Discount "Test 100% off" | `91dcb2de-c93d-4989-b0d5-fdc982a1313c` | Code `TEST100`, 100% off, once, Test Product only |

Webhook events subscribed: `checkout.created/updated`, `order.created/paid/updated/refunded`,
`subscription.created/updated/active/canceled/uncanceled/revoked`, `refund.created/updated`,
`customer.created/updated/deleted/state_changed`, `benefit_grant.created/updated/revoked`,
`product.created/updated`.

The URL uses the `www.` host on purpose: `www.al-ai-fx.xyz` is the canonical host and Polar does not follow
redirects, so registering a host that redirects would make every delivery fail.

## Testing end to end

1. Deploy this branch and set the env vars above. Before deploying, `https://www.al-ai-fx.xyz/api/webhooks/polar` returns 404.
2. Check the endpoint is live: an unsigned `POST` should return **403** (or **503** if
   `POLAR_WEBHOOK_SECRET` is missing).
3. Start a checkout for the Test Product — `/api/checkout/polar?products=43d42d45-6a3c-44bc-9939-461993908fc2` — and apply code `TEST100`
   (total becomes $0, so no real card charge).
4. In Polar → Settings → Webhooks → this endpoint, confirm the deliveries returned 200.

## Before going live

- Implement the `order.paid` / `customer.state_changed` handlers (dedupe on the `webhook-id` header).
- Archive the Test Product and delete or deactivate the `TEST100` discount — it gives the
  Test Product away for free to anyone who has the code.

