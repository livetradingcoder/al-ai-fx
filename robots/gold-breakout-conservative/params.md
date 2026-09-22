# Gold Breakout Conservative — Values (SOURCE OF TRUTH)

One session range a day on XAUUSD (M1 bars), traded on the first break with a
market order and a stop-order hedge behind it. Tighter targets and a lighter
hedge than Breakout Aggressive. Formerly "GoldEA Vision V2".

Source: `~/Documents/RrobotiGOLD/ORGANIZED/TO SELL/ALAIFX-Gold-Breakout-Conservative.mq5`
(= `to be edited/GoldEA-Vision-V2-TP2-SL13.3-x5.mq5`), sha256 `dfb3224a8236…`,
imported 2026-09-22.

## Changes from the source file

Same as Breakout Aggressive: branding, print tag `BreakoutC:`, trade comment
base `AL-ai-FX BreakoutC`, inert `allowed_accounts {0}`, runtime
`IsLicenceExpired()`, ASCII/LF. Strategy untouched.

## Customer-visible inputs

| Input | Default |
|---|---|
| Lot Size | 0.03 |
| Multiplier (x) | 5.0 |
| Start / Stop (server time) | 07:00 / 10:00 |

## Hidden values

| Setting | Value |
|---|---|
| Magic Number | 20260512 |
| Trade comment base | AL-ai-FX BreakoutC — MUST NOT contain underscores |
| Buy SL / TP | 13.3 / 2.0 |
| Sell SL / TP | 13.3 / 2.0 |
| Entry buffer | 0.16 |
| Hedge TP | 2.0 |
