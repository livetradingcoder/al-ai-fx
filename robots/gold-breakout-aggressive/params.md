# Gold Breakout Aggressive — Values (SOURCE OF TRUTH)

One session range a day on XAUUSD (M1 bars), traded on the first break with a
market order and a stop-order hedge behind it. Formerly "GoldEA Vision V1".

Source: `~/Documents/RrobotiGOLD/ORGANIZED/TO SELL/ALAIFX-Gold-Breakout-Aggressive.mq5`
(= `to be edited/GoldEA-Vision-V1-TP5-SL15-x15.mq5`), sha256 `1084a2e3da56…`,
imported 2026-09-22.

Near-twin of PrecisionTrader (same 07:00–10:00 window, same 15/5 stops and
targets, same 15x hedge). Differences: hedge TP 1.5 vs 1.3, M1 vs H1 range
bars, and here the session window and multiplier are customer inputs.

## Changes from the source file

Strategy logic and values untouched. Branding (`#property` block pointed at
visionfx.cc), print tag `BreakoutA:`, trade comment base `AL-ai-FX BreakoutA`,
inert `allowed_accounts {0}` (file carried personal MT5 logins), runtime
`IsLicenceExpired()` (no new trades after the licence ends, stray hedge
cleanup continues), ASCII/LF.

## Customer-visible inputs

| Input | Default |
|---|---|
| Lot Size | 0.03 |
| Multiplier (x) | 15.0 |
| Start / Stop (server time) | 07:00 / 10:00 |

## Hidden values

| Setting | Value |
|---|---|
| Magic Number | 20260511 |
| Trade comment base | AL-ai-FX BreakoutA — MUST NOT contain underscores |
| Buy SL / TP | 15.0 / 5.0 |
| Sell SL / TP | 15.0 / 5.0 |
| Entry buffer | 0.16 |
| Hedge TP | 1.5 |
