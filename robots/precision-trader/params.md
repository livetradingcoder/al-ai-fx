# PrecisionTrader — Predefined Values (SOURCE OF TRUTH)

Single-range breakout with hedge management, XAUUSD. Adapted 2026-07-27 from
`robots/goldshield/candidates/goldea-vision-51513-hedgi.mq5` (the candidate that
was picked); the other candidate, `visionfx-newversion2.mq5`, stays unreleased.

These values ARE the strategy. If a build ever disagrees with this file, this
file wins and the build must be fixed.

Two builds, identical logic:

- **MASTER.mq5 (hidden values)** — only Lot Size visible. Everything below is
  `const`. This is what customers compile against.
- **variants/predefined.mq5** — same code with every setting exposed as an
  `input`, for testing and tuning only. Never release this one: it hands the
  strategy to whoever opens the inputs tab.

Rebranded from the vendor original: prints, `#property` block and the trade
comment base now read `PrecisionTrader` (no underscores — the trade-comment
parser reserves `_1_R` / `_2_R` suffixes). Vendor's own account allowlist was
replaced with the inert `{0}` the daemon overwrites per job.

## Basic Setting

| Setting | Value |
|---|---|
| Lot Size | 0.03 (the one customer-visible input) |
| Multiplier (x) | 15.0 |
| Range Build Timeframe | H1 |
| Magic Number | 20260502 |
| Trade comment base | PrecisionTrader — MUST NOT contain underscores |

## Time Settings (server time)

| Setting | Value |
|---|---|
| Start | 07:00 |
| Stop | 10:02 |

## Trade Settings (points)

| Setting | Value |
|---|---|
| Primary Buy Stop Loss | 15.0 |
| Primary Buy Take Profit | 5.0 |
| Primary Sell Stop Loss | 15.0 |
| Primary Sell Take Profit | 5.0 |
| Range Entry Buffer | 0.16 |
| Hedge Take Profit | 1.3 |

## Hedge Management

| Setting | Value |
|---|---|
| Enable Hedge Breakeven | false |
| Breakeven Trigger | 0.5 |
| Breakeven Offset | 0.1 |
| Enable Early Cut on Re-Entry | false |
| Re-entry Distance Inside Range to Close | 2.0 |

Both hedge features ship **off**. They are opt-in experiments in the predefined
build; turning either on for customers means a new release version, not a
config change — customers have no input for them.
