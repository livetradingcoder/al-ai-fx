# Gold MultiRange 6 Aggressive — Values (SOURCE OF TRUTH)

Six independent session-range breakouts on XAUUSD: the four MultiRange 4
ranges plus the two morning Breakout sessions (Aggressive and Conservative
values) in slots 2 and 3.

Source: `~/Documents/RrobotiGOLD/ORGANIZED/TO SELL/ALAIFX-Gold-MultiRange-6-Aggressive.mq5`,
sha256 `60f1e577511c…`, imported 2026-09-22.

## Changes from the source file

Identical to the MultiRange 4 list (see `../gold-multirange-4/params.md`):
branding with print tag `MR6:`, inert `allowed_accounts {0}`, `ExpiredON`
true, hidden comment base `AL-ai-FX MR6`, runtime `IsLicenceExpired()`,
ASCII/LF. Magic base `20250526` → `20260601` (unique across our robots).

## Customer-visible inputs

| Input | Default |
|---|---|
| Lotsize Mode | Fixed lot (or Risk percent) |
| Fixed Lot Size | 0.1 |
| Risk Percent | 1.0 |
| Magic Number Base | 20260601 (ranges use base+0 … base+6) |
| Range 1 / 2 / 3 / 4 / 6 / 7 enable | on |

## Ranges (server time, H1 bars) — all hidden

| Range | Window | Buy SL / TP | Sell SL / TP | Hedge x | Hedge TP | Buffer | State |
|---|---|---|---|---|---|---|---|
| 1 | 01:00–05:00 | 21.0 / 3.7 | 11.2 / 1.5 | 5 | 2.0 | 0.16 | ON |
| 2 | 07:00–10:00 | 15.0 / 5.0 | 15.0 / 5.0 | 15 | 1.5 | 0.16 | ON (Breakout Aggressive) |
| 3 | 07:00–10:00 | 13.3 / 2.0 | 13.3 / 2.0 | 5 | 2.0 | 0.16 | ON (Breakout Conservative) |
| 4 | 00:00–04:35 | 13.8 / 2.1 | 12.5 / 1.8 | 5 | 2.5 | 0.16 | ON |
| 5 | 00:00–06:00 | 11.8 / 2.1 | 12.0 / 1.8 | 3 | 4.5 | 0.16 | off (hidden) |
| 6 | 01:00–03:00 | 11.8 / 2.1 | 12.0 / 1.8 | 5 | 2.5 | 0.16 | ON |
| 7 | 02:00–03:00 | 11.8 / 2.1 | 12.0 / 1.8 | 5 | 2.5 | 0.16 | ON |

Range 2's 15x hedge is what makes this build "aggressive": a failed break on
that range opens a hedge fifteen times the primary lot.

GoldBot Double Range's second range (02:35–11:05) is NOT in this product —
slot 2 was repurposed for the Breakout Aggressive session.
