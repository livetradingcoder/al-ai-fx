# Polar setup — al-ai-fx

Polar organization: **algo-trading-school** (`7b8bd3a1-1ac4-494f-a125-ab40c0e5d7ee`), **production** server.
The org is shared with algotradingschool (`/api/webhook/polar`); each app has its own webhook endpoint and signing secret.

## How a Polar order becomes a licence

A Polar product maps to a **(robot, tier)** through metadata: `robot=<Robot.slug>` and
`tier=<tier slug from TIER_METADATA>` (`10-days`, `1-month`, `6-months`, `1-year`, `lifetime`,
`lifetime-source`, `secret-test`). Set it on the product in the Polar dashboard (Products → … →
Metadata), or let `/api/checkout/polar` pass it as checkout metadata. Checkout metadata wins.

1. The checkout page's **Pay by card** button posts `{email, tier, robotSlug, couponCode}` to
   `POST /api/checkout/polar` (the crypto button still posts to `/api/paygate/create-session`). The
   server resolves the price itself — list price from `RobotPrice`, referral discount or coupon,
   whichever is cheaper (`src/lib/checkout-pricing.ts`, shared with Paygate) — and creates the Polar
   checkout with that amount as an **ad-hoc price** on the product mapped to robot + tier, Polar
   discount codes disabled, and metadata `{robot, tier, ref, coupon}`. A coupon that zeroes the price
   provisions directly (same as Paygate) and never reaches Polar. The success URL is the existing
   thank-you page with `orderRef=POLAR-{CHECKOUT_ID}`.
   `GET /api/checkout/polar?robot=&tier=` does the same at the catalog price, for links from emails or
   landing pages.
2. On `order.paid` the webhook resolves the mapping and calls `provisionSubscription(email, tier, robot,
   "POLAR-<checkout id>", net_amount/100, currency, ref)` — the same path Paygate uses: find-or-create the
   user, create the ACTIVE `Subscription`, record the `Order` (external id in `Order.paygateId`),
   commission, redeem the coupon from the metadata, and send the purchase email with the dashboard
   magic link.
3. The thank-you page polls `/api/paygate/order-status?orderRef=POLAR-<checkout id>` until that `Order`
   row exists, so the buyer sees the normal confirmation.

Idempotency: `provisionSubscription` short-circuits when an `Order` with that external id exists, so a
redelivered `order.paid` is a no-op. Orders the webhook can't fulfil (no email, no robot/tier mapping,
unknown or inactive robot/price) get a **400**; Polar retries and shows the delivery as failed, which
makes a mis-mapped product visible. Only `billing_reason=purchase` orders are provisioned.

| File | Purpose |
|---|---|
| `src/lib/polar.ts` | Polar client; `resolvePolarOrderTarget`, `polarOrderRef`, `polarOrderAmount` (tested in `polar.test.ts`) |
| `src/lib/checkout-pricing.ts` | Server-side price + discount rule and the free-coupon provisioning, shared by Polar and Paygate |
| `src/app/api/webhooks/polar/route.ts` | Webhook receiver: verifies the signature, provisions on `order.paid` |
| `src/app/api/checkout/polar/route.ts` | `POST` for the checkout page's card button; `GET` redirect for links |
| `src/app/[locale]/checkout/CheckoutClient.tsx` | "Pay by card" (Polar) primary button, "Pay with crypto via Paygate.to" secondary |

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
| Gold MultiRange 4 · 10 Days | `01bac623-6460-4f4c-8e8a-700f1b68c555` | $29, metadata `robot=gold-multirange-4 tier=10-days` |
| Gold MultiRange 4 · 1 Month | `939daa71-259a-4ce7-9cd4-fa910fe38cfc` | $99, `tier=1-month` |
| Gold MultiRange 4 · 6 Months | `a8c9af7f-c91b-40fc-a741-1c6d9ab1f0d2` | $449, `tier=6-months` |
| Gold MultiRange 4 · 1 Year | `f7f006ee-1797-4358-a69f-f3c0c51ef315` | $999, `tier=1-year` |
| PrecisionTrader · 10 Days | `c1b44f43-f151-4725-a4fe-a317adce7d46` | $9, metadata `robot=precision-trader tier=10-days` |
| PrecisionTrader · 1 Month | `37ac52e1-443d-4266-9e79-a4becb0e250b` | $39, `tier=1-month` |
| PrecisionTrader · 6 Months | `efd73654-d434-4f1a-913a-c1b980b6cb1d` | $179, `tier=6-months` |
| PrecisionTrader · 1 Year | `5a4301e7-61c2-427e-aeb5-448eeb9ab78a` | $399, `tier=1-year` |
| Product "Test Product" | `43d42d45-6a3c-44bc-9939-461993908fc2` | $10.00 USD, one-time; no metadata (pass robot/tier as checkout metadata to test) |
| Product "Algo Trading School Pro" | `ce2ffc11-26dc-4357-8ad7-efb7d72e54b4` | €29 / $32, the school's product — no robot mapping, not for this app |

The catalog prices above mirror `RobotPrice` at creation time, but the checkout page always sends the
DB price (after discounts) as an ad-hoc price, so a price change in the DB takes effect without touching
Polar. Polar's own prices only apply to the `GET` redirect links.
| Webhook endpoint | `44407786-898b-4786-9538-30a8c36970a4` | `https://www.al-ai-fx.xyz/api/webhooks/polar`, format `raw`, 23 events |
| Discount "Test 100% off" | `91dcb2de-c93d-4989-b0d5-fdc982a1313c` | Code `TEST100`, 100% off, once; Test Product and Pro |

Webhook events subscribed: `checkout.created/updated`, `order.created/paid/updated/refunded`,
`subscription.created/updated/active/canceled/uncanceled/revoked`, `refund.created/updated`,
`customer.created/updated/deleted/state_changed`, `benefit_grant.created/updated/revoked`,
`product.created/updated`.

The URL uses the `www.` host on purpose: `www.al-ai-fx.xyz` is the canonical host and Polar does not
follow redirects, so registering a host that redirects would make every delivery fail.

## Adding products

When a robot or tier is added, create a Polar product with metadata `robot=<slug>` and `tier=<tier slug>`
(the pair must have an active `RobotPrice` row; `scripts/onboard-robots-2026-09.js` creates
TEN_DAYS … LIFETIME_SOURCE). Without one, the card button answers 404 "Card checkout is not available
for this plan yet — pay with crypto instead" and the crypto button still works.

## Testing end to end

1. Deploy `main` and set the env vars above. Before deploying, `https://www.al-ai-fx.xyz/api/webhooks/polar` returns 404.
2. Check the endpoint is live: an unsigned `POST` should return **403** (or **503** if `POLAR_WEBHOOK_SECRET` is missing).
3. Card flow: on `/checkout?robot=gold-multirange-4&tier=10-days`, enter an email and click **Pay by
   card**. You land on Polar's page at the DB price; pay (a real card) and you return to
   `/checkout/thank-you?orderRef=POLAR-<id>`, which flips to confirmed once the webhook has run.
   For a $0 rehearsal use an app coupon that zeroes the price (provisions directly, no Polar), or create
   a checkout against the Test Product via the API with `discount_id` = TEST100 and metadata
   `robot`/`tier` — that is what was done on 2026-10-09 (order `a41aeceb-…`, delivery 200, Order row
   `SUCCESS`).
4. In Polar → Settings → Webhooks → this endpoint, confirm `order.paid` returned 200. The buyer's email
   now has a user, an ACTIVE `Subscription`, an `Order` with `paygateId=POLAR-<checkout id>`, and
   received the purchase email with the dashboard magic link.

## Before going live

- Archive the Test Product and delete or deactivate the `TEST100` discount.
- `customer.state_changed` is acknowledged but not acted on: expiry is enforced inside the compiled EA
  from `Subscription.expiresAt`, not from Polar's customer state.
- Known pre-existing behaviour shared with Paygate: a repeat purchase of the same robot + tier while a
  subscription is still ACTIVE returns `duplicated` and is not extended. Handle in `provisionSubscription`
  if Polar is going to carry renewals.
