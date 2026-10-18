# Outbound webhooks

AL-AI-FX posts an event to every enabled webhook after each **signup**, **trial** and **sale**.
Manage endpoints and watch deliveries at **Dashboard → Admin → Webhooks**
(`/dashboard/admin/webhooks`, admins only).

Code: `src/lib/outbound-webhooks.ts` (dispatcher, signing, SSRF guard), hooks in
`src/lib/subscriptions.ts` (`provisionSubscription`), admin UI in
`src/app/[locale]/dashboard/admin/webhooks/`.

## One-time setup after deploying

The feature adds two tables (`OutboundWebhook`, `OutboundWebhookDelivery`). Apply the migration once:

```bash
npx prisma migrate deploy      # in the al-ai-fx container (Coolify → Terminal)
```

Until then the admin page shows a banner instead of the list, and sales/signups are unaffected
(a webhook problem can never fail an order).

## Connecting a WhatsApp relay

1. In the app that owns the relay, create a relay:
   - **Relay name** — `AL-AI-FX`
   - **Target group** — the WhatsApp group to notify
   - **Dashboard base URL** — `https://www.al-ai-fx.xyz`
2. Copy the relay's **Webhook URL** and **Secret**.
3. In AL-AI-FX → Admin → Webhooks → **Add webhook**: paste both, keep all three events ticked, save.
4. Click **Send test**. The row reports the HTTP status the relay answered with, and the group gets
   "✅ Test event". If it does not, open the delivery under **Deliveries → View**.

## Request

`POST <your URL>` with `Content-Type: application/json`:

| Header | Value |
| --- | --- |
| `X-Webhook-Signature` | hex HMAC-SHA256 of the **raw request body**, keyed with the secret (`sha256=` prefix if the endpoint is set to "Prefixed") |
| `X-Hub-Signature-256` | the same signature, always as `sha256=<hex>` |
| `X-Webhook-Id` | id of this delivery (identical on every retry and on "Send again" — dedupe on it) |
| `X-Webhook-Event` | `user.signup` · `trial.started` · `sale.completed` · `webhook.test` |
| `X-Webhook-Timestamp` | unix seconds when the attempt was sent (informational, not signed) |
| `User-Agent` | `al-ai-fx-webhooks/1.0` |

Body:

```json
{
  "id": "6f0c…",
  "event": "sale.completed",
  "created_at": "2026-10-15T12:00:00.000Z",
  "site": "AL-AI-FX",
  "title": "💰 New sale — Gold MultiRange 4 · Ten Days",
  "message": "💰 New sale — Gold MultiRange 4 · Ten Days\n$39.00 via Polar\nbuyer@example.com\nReferral: ABC123\nOrder POLAR-co_1",
  "path": "/dashboard/admin/orders",
  "url": "https://www.al-ai-fx.xyz/dashboard/admin/orders",
  "data": { "orderRef": "POLAR-co_1", "provider": "Polar", "amount": 39, "currency": "USD", "…": "…" }
}
```

`message` is ready to forward as-is; `data` carries the structured fields (order, buyer, robot, tier,
referral code, provider) for anything fancier.

### Verifying the signature (receiver side)

```js
const expected = crypto.createHmac("sha256", SECRET).update(rawBody).digest("hex");
const got = req.headers["x-webhook-signature"].replace(/^sha256=/, "");
const ok = got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
```

Hash the **raw** bytes, not a re-serialised object.

## Delivery rules

- **2xx = delivered.** Anything else, a timeout (10 s) or a network error counts as a failed attempt.
- Up to **3 attempts** (now, +3 s, +12 s). No retry on 4xx other than 408/429 — a 401/403 means the
  secret or URL is wrong and retrying would not help.
- A delivery that still fails stays **FAILED** in the log; **Send again** re-posts the same body.
- Redirects are **not followed**.
- Only `https://` URLs on public addresses are accepted. Loopback, private, link-local, CGNAT and cloud
  metadata addresses are rejected, re-checked on every send.
- Sends run in the background after the order is saved and never block or fail checkout.
- The delivery log is kept **30 days**.

## Events

| Event | Fires when |
| --- | --- |
| `user.signup` | An account is created (by a purchase or a trial). Not for existing customers buying again. |
| `trial.started` | A trial licence is issued. `data.paid` is true when the robot charges for its trial, and `data.days` is how long it runs. |
| `sale.completed` | An order is recorded — Polar, OxaPay, Whop, Paygate, a 100% coupon (shows as a free order). |

A trial the robot charges for is announced twice, in this order: `trial.started` (with `paid: true`, and the
signup folded in when it made the account) and then `sale.completed` for the fee, whose title says
`3-Day Trial` or `7-Day Trial` and whose `data.trialDays` carries the length. Its `tier` is `FREE_TRIAL`
either way: the amount is what tells a free trial from a paid one.
| `webhook.test` | **Send test** in the admin. Never sent automatically. |

Redelivered provider callbacks (the same payment notified twice) emit nothing the second time.

## Rotating a secret

Edit the webhook, paste the new secret (leave blank to keep the current one), save, then **Send test**.
Change it on the receiving side first or at the same moment: events signed with the old secret are
rejected by a receiver that already has the new one.
