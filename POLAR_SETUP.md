# Polar setup — al-ai-fx

Polar organization: **algo-trading-school** (`7b8bd3a1-1ac4-494f-a125-ab40c0e5d7ee`), **production** server.
The org is shared with algotradingschool (`/api/webhook/polar`); each app has its own webhook endpoint and signing secret.

## How a Polar order becomes a licence

A Polar product maps to a **(robot, tier)** through metadata: `robot=<Robot.slug>` and
`tier=<tier slug from TIER_METADATA>` (`10-days`, `1-month`, `6-months`, `1-year`, `lifetime`,
`lifetime-source`, `secret-test`). Set it on the product in the Polar dashboard (Products → … →
Metadata), or let `/api/checkout/polar` pass it as checkout metadata. Checkout metadata wins.

1. `GET /api/checkout/polar?robot=<slug>&tier=<tier>[&email=][&locale=]` finds the Polar product whose
   metadata matches (or takes `products=<id>`), creates the checkout with metadata
   `{robot, tier, ref}` (`ref` = affiliate cookie), and redirects to Polar. Its success URL is the
   existing thank-you page with `orderRef=POLAR-{CHECKOUT_ID}`.
2. On `order.paid` the webhook resolves the mapping and calls `provisionSubscription(email, tier, robot,
   "POLAR-<checkout id>", net_amount/100, currency, ref)` — the same path Paygate uses: find-or-create the
   user, create the ACTIVE `Subscription`, record the `Order` (external id in `Order.paygateId`),
   commission, and send the purchase email with the dashboard magic link.
3. The thank-you page polls `/api/paygate/order-status?orderRef=POLAR-<checkout id>` until that `Order`
   row exists, so the buyer sees the normal confirmation.

Idempotency: `provisionSubscription` short-circuits when an `Order` with that external id exists, so a
redelivered `order.paid` is a no-op. Orders the webhook can't fulfil (no email, no robot/tier mapping,
unknown or inactive robot/price) get a **400**; Polar retries and shows the delivery as failed, which
makes a mis-mapped product visible. Only `billing_reason=purchase` orders are provisioned.

| File | Purpose |
|---|---|
| `src/lib/polar.ts` | Polar client; `resolvePolarOrderTarget`, `polarOrderRef`, `polarOrderAmount` (tested in `polar.test.ts`) |
| `src/app/api/webhooks/polar/route.ts` | Webhook receiver: verifies the signature, provisions on `order.paid` |
| `src/app/api/checkout/polar/route.ts` | Redirect to Polar's hosted checkout for a robot + tier |

## Environment variables

Set these in **Coolify → al-ai-fx app (`jwsc0g04w4w04ksc480ocgko`) → Environment Variables**, then redeploy
(the app moved off Vercel in July 2026; see `.planning/HANDOFF-2026-07-21.md`):

| Name | Value |
|---|---|
| `POLAR_ACCESS_TOKEN` | Organization access token (`polar_oat_…`) |
| `POLAR_WEBHOOK_SECRET` | Signing secret of this app's webhook endpoint (below) |
| `POLAR_SERVER` | `production` (default; `sandbox` only for testing against sandbox.polar.sh) |

Never commit these. The webhook secret is not in this file: open Polar → Settings → Webhooks → this
endpoint to view or regenerate it (update the env var after regenerating).

## Resources in Polar

| Resource | ID | Details |
|---|---|---|
| Product "Test Product" | `43d42d45-6a3c-44bc-9939-461993908fc2` | $10.00 USD, one-time; metadata `robot=gold-multirange-4`, `tier=10-days` |
| Product "Algo Trading School Pro" | `ce2ffc11-26dc-4357-8ad7-efb7d72e54b4` | €29 / $32, the school's product — no robot mapping, not for this app |
| Webhook endpoint | `44407786-898b-4786-9538-30a8c36970a4` | `https://www.al-ai-fx.xyz/api/webhooks/polar`, format `raw`, 23 events |
| Discount "Test 100% off" | `91dcb2de-c93d-4989-b0d5-fdc982a1313c` | Code `TEST100`, 100% off, once; Test Product and Pro |

Webhook events subscribed: `checkout.created/updated`, `order.created/paid/updated/refunded`,
`subscription.created/updated/active/canceled/uncanceled/revoked`, `refund.created/updated`,
`customer.created/updated/deleted/state_changed`, `benefit_grant.created/updated/revoked`,
`product.created/updated`.

The URL uses the `www.` host on purpose: `www.al-ai-fx.xyz` is the canonical host and Polar does not
follow redirects, so registering a host that redirects would make every delivery fail.

## Adding real products

For every robot tier you want to sell through Polar, create a product in Polar with the price and set
metadata `robot=<slug>` and `tier=<tier slug>`. The pair must have an active `RobotPrice` row
(`scripts/onboard-robots-2026-09.js` creates TEN_DAYS … LIFETIME_SOURCE; `secret-test` does not exist in
the DB, which is why the Test Product maps to `10-days`). Then link to
`/api/checkout/polar?robot=<slug>&tier=<tier>` — the checkout page itself still uses Paygate.

## Testing end to end

1. Deploy `main` and set the env vars above. Before deploying, `https://www.al-ai-fx.xyz/api/webhooks/polar` returns 404.
2. Check the endpoint is live: an unsigned `POST` should return **403** (or **503** if `POLAR_WEBHOOK_SECRET` is missing).
3. Open `https://www.al-ai-fx.xyz/api/checkout/polar?robot=gold-multirange-4&tier=10-days`, apply code
   `TEST100` (total $0, no card charge) and pay. You land on `/checkout/thank-you?orderRef=POLAR-<id>`,
   which flips to confirmed once the webhook has run.
4. In Polar → Settings → Webhooks → this endpoint, confirm `order.paid` returned 200. The buyer's email
   now has a user, an ACTIVE 10-day `Subscription` on Gold MultiRange 4, an `Order` with
   `paygateId=POLAR-<checkout id>`, and received the purchase email with the dashboard magic link.

## Before going live

- Archive the Test Product and delete or deactivate the `TEST100` discount.
- `customer.state_changed` is acknowledged but not acted on: expiry is enforced inside the compiled EA
  from `Subscription.expiresAt`, not from Polar's customer state.
- Known pre-existing behaviour shared with Paygate: a repeat purchase of the same robot + tier while a
  subscription is still ACTIVE returns `duplicated` and is not extended. Handle in `provisionSubscription`
  if Polar is going to carry renewals.
