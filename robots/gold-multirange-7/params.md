# Gold MultiRange 7 — Values (SOURCE OF TRUTH)

Seven independent session-range breakouts on XAUUSD: every range slot of the
GoldBot-Hybrid engine switched on. Includes both of GoldBot Double Range's
ranges (slots 1 and 2), so it is the full successor to that robot.

Source: `~/Documents/RrobotiGOLD/ORGANIZED/TO SELL/ALAIFX-Gold-MultiRange-7.mq5`
(identical to `ORGANIZED/7 entry.mq5`), sha256 `b2ca24bf0f2f…`, imported
2026-09-22.

## Changes from the source file

Same list as MultiRange 4 (see `../gold-multirange-4/params.md`): branding
with print tag `MR7:`, inert `allowed_accounts {0}` (file carried personal MT5
logins), `ExpiredON` true, hidden comment base `AL-ai-FX MR7`, runtime
`IsLicenceExpired()`, ASCII/LF. Magic base `20250526` → `20260701` (unique
across our robots). Strategy values untouched.

## Customer-visible inputs

| Input | Default |
|---|---|
| Lotsize Mode | Fixed lot (or Risk percent) |
| Fixed Lot Size | 0.1 |
| Risk Percent | 1.0 |
| Magic Number Base | 20260701 (ranges use base+0 … base+6) |
| Range 1–7 enable | on |

## Ranges (server time, H1 bars) — all hidden

| Range | Window | Buy SL / TP | Sell SL / TP | Hedge x | Hedge TP | Buffer |
|---|---|---|---|---|---|---|
| 1 | 01:00–05:00 | 21.0 / 3.7 | 11.2 / 1.5 | 5 | 2.0 | 0.16 |
| 2 | 02:35–11:05 | 11.8 / 2.1 | 12.0 / 1.8 | 3 | 4.5 | 0.16 |
| 3 | 07:00–10:00 | 13.3 / 2.0 | 12.5 / 1.7 | 5 | 2.0 | 0.16 |
| 4 | 00:00–04:35 | 13.8 / 2.1 | 12.5 / 1.8 | 5 | 2.5 | 0.16 |
| 5 | 00:00–06:00 | 11.8 / 2.1 | 12.0 / 1.8 | 3 | 4.5 | 0.16 |
| 6 | 01:00–03:00 | 11.8 / 2.1 | 12.0 / 1.8 | 5 | 2.5 | 0.16 |
| 7 | 02:00–03:00 | 11.8 / 2.1 | 12.0 / 1.8 | 5 | 2.5 | 0.16 |

Largest hedge is 5x — no 15x range, unlike MultiRange 6 Aggressive. All
seven ranges share one lot size, and several windows overlap, so more than
one range can hold a position at the same time.
