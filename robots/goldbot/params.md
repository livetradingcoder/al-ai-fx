# GoldBot DoubleRange — Predefined Values (SOURCE OF TRUTH)

These values ARE the strategy. Both .mq5 builds carry them; if a build ever disagrees with this file, this file wins and the build must be fixed.

Two builds, identical logic:

- **Hidden Values** — only Risk Mode, Lot size, Compound visible. All values below hardcoded.
- **Predefined Values** — all values below exposed as inputs with section separators, for testing.

Broker variants (created 2026-07-12, byte-identical copies of the masters — currently NO code difference, EA reads symbol from chart so .u/.r suffix needs none; diverge only if a broker-specific quirk is proven):

- `... Broker1.mq5` — for the normal broker (XAUUSD.r — **backtest confirmed working 2026-07-12**: one pending pair per range, opposite canceled on fill, hedge placed, TPs hit)
- Broker2 copies deleted 2026-07-12 (were byte-identical to masters; recreate from master if .u broker ever proves quirky).
- Masters stay untouched reference.

Consolidation check 2026-07-12: all 3 Hidden files byte-identical; all 3 Predefined files byte-identical; Hidden vs Predefined logic-identical (only `input` keyword + separator rows differ); all 29 settings verified equal across builds. Hidden Values Broker1 is the deploy build of the tested config.

Base: double-rangeGG-EA-Bot v20260505_4_1, XAUUSD M5.
Values verified against live test screenshot (Roland FFF, 08.05.26).

## Basic Setting

| Setting | Value |
|---|---|
| Lotsize Mode | Fixed Lotsize (FIXED_LOT) |
| Fixed Lot Size | 0.1 |
| Risk Percent (%) | 1.0 |
| Magic Number Base | 20250526 (Range 1 = base, Range 2 = base + 1) |
| Trade Comment base | GG - GoldBot — MUST NOT contain underscores |

## Trade Restrictions

| Setting | Value |
|---|---|
| Custom holiday dates | (empty) |

## Time Settings (server time)

| Setting | Range 1 | Range 2 |
|---|---|---|
| Start | 01:00 | 02:35 |
| Stop | 05:00 | 11:05 |

## Trade Settings — RANGES ARE DIFFERENT

| Setting | Range 1 | Range 2 |
|---|---|---|
| Maximum Stop Loss First Buy ($) | **21.0** | 11.8 |
| Take Profit First Buy ($) | **3.7** | 2.1 |
| Buffer ($) | 0.16 | 0.16 |
| Maximum Stop Loss First Sell ($) | **11.2** | 12.0 |
| Take Profit First Sell ($) | **1.5** | 1.8 |
| Lotsize Multiplier for Hedge | **5.0** | 3.0 |
| Take Profit for Hedge ($) | **2.0** | 4.5 |

## Hybrid Setting

| Setting | Value |
|---|---|
| Min Distance Multiplier (x stops level) | 1.5 |

## Notes

- **Order recognition hardened 2026-07-12.** Original v20260505_4_1 identified own orders by splitting the comment on "_" and reading position [1] — any underscore in the comment base (old default `1p_GG_GoldBot`) broke recognition and the EA re-placed buy/sell stops every tick (order spam). Both builds now match the `_1_R` (primary) / `_2_R` (hedge) tag anywhere in the comment, so recognition is position-independent. Comment base kept underscore-free (`GG - GoldBot`) anyway.
- Range 1 and Range 2 are tuned separately — do NOT copy one into the other.
- Predefined Values build with untouched defaults behaves exactly like Hidden Values build — zero-change baseline test.
- Expiry: 2050.02.05. Account protection active (allowed accounts hardcoded in source).
