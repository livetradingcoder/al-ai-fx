# Gold MultiRange 4 — Values (SOURCE OF TRUTH)

Four independent session-range breakouts on XAUUSD, each with its own stops,
targets and hedge. The GoldBot-Hybrid engine with four of its seven range
slots switched on.

Source: `~/Documents/RrobotiGOLD/ORGANIZED/TO SELL/ALAIFX-Gold-MultiRange-4.mq5`
(identical to `ORGANIZED/4 entry.mq5`), sha256 `3c6775ac6e34…`, imported
2026-09-22.

## Changes from the source file

Strategy logic and values are untouched. Only:

- Branding: `#property` block, header, print tag `MR4:`.
- `allowed_accounts[]` → inert `{0}` (the file carried personal MT5 logins;
  the daemon overwrites the line per buyer anyway). `ExpiredON` → `true`
  (the daemon forces it too; this keeps the master safe if that ever changes).
- Trade comment base `GG - GoldBot` → `AL-ai-FX MR4`, and no longer an input:
  a customer typing `_` into it would break the `_1_R` / `_2_R` parsing the
  EA uses to find its own orders.
- Magic base `20250526` → `20260401`: the old base collided with GoldBot
  Double Range and MultiRange 6, so two of our robots on one account would
  have read each other's orders.
- `IsLicenceExpired()` — stops NEW trades once the licence ends even if the
  terminal is never restarted (OnInit alone only checks at attach time).
  Open positions and hedges are still managed.
- Comments normalised to ASCII, LF line endings.

## Customer-visible inputs

| Input | Default |
|---|---|
| Lotsize Mode | Fixed lot (or Risk percent) |
| Fixed Lot Size | 0.1 |
| Risk Percent | 1.0 |
| Magic Number Base | 20260401 (ranges use base+0 … base+6) |
| Range 1 / 4 / 6 / 7 enable | on |

## Ranges (server time, H1 bars) — all hidden

| Range | Window | Buy SL / TP | Sell SL / TP | Hedge x | Hedge TP | Buffer | State |
|---|---|---|---|---|---|---|---|
| 1 | 01:00–05:00 | 21.0 / 3.7 | 11.2 / 1.5 | 5 | 2.0 | 0.16 | ON |
| 2 | 02:35–11:05 | 11.8 / 2.1 | 12.0 / 1.8 | 3 | 4.5 | 0.16 | off (hidden) |
| 3 | 07:00–10:00 | 13.3 / 2.0 | 12.5 / 1.7 | 5 | 2.0 | 0.16 | off (hidden) |
| 4 | 00:00–04:35 | 13.8 / 2.1 | 12.5 / 1.8 | 5 | 2.5 | 0.16 | ON |
| 5 | 00:00–06:00 | 11.8 / 2.1 | 12.0 / 1.8 | 3 | 4.5 | 0.16 | off (hidden) |
| 6 | 01:00–03:00 | 11.8 / 2.1 | 12.0 / 1.8 | 5 | 2.5 | 0.16 | ON |
| 7 | 02:00–03:00 | 11.8 / 2.1 | 12.0 / 1.8 | 5 | 2.5 | 0.16 | ON |

Range 1 is GoldBot Double Range's first range. Its second range (02:35–11:05)
is slot 2 here and is OFF — it is not part of this product.

Other hidden values: min stop distance multiplier 1.5 (floor 0.50), built-in
US/UK/EU bank-holiday calendar 2023–2030.
