# Day 6 Task 5 — canonical trade vertical verification

Date: 2026-08-09
Repository: `Dtwosam/bread`
Branch: `agent/day6-task5-trade-vertical`
Baseline: `ab2f4e600d7f73c44fb4ec67875f2da9ff94d6d9`
PR: #45

## Scope

Task 5 is limited to the approved Day-6 trade vertical:

- transaction-local BUY correlation of optional `CurveBuyRefunded` plus mandatory `OpeningProtectionApplied` into canonical `CurveBuy` identity;
- canonical SELL identity from `CurveSell`;
- exact integer BUY/SELL amounts and rational execution-price representation;
- synchronous `trades`, `launch_state`, 1m/5m/1h `market_candles`, and `token_metrics` projections;
- bounded deterministic `GET /v1/tokens/:address/trades` cursor pagination;
- Token/New-feed enrichment only from supported indexed Task-5 projections.

No Task-6 fee/admin/graduation projection and no server financial signing/submission authority is included.

## Initial RED — proven

Exact head: `e4f5fb928934becf1328386156fb87737ecc99b5`

Inherited CI: `31314769880`

- bootstrap validation: PASS;
- Foundry/ABI: PASS;
- inherited Task-4 PostgreSQL lane: PASS;
- dependency-build failed only after the new Task-5 behavior executed in `pnpm test:day6`.

Dedicated Task-5 PostgreSQL workflow: `31314769925`

- checkout/install: PASS;
- PostgreSQL ready: PASS;
- Redis `PONG`: PASS;
- `tests/day6/trade-vertical.test.ts`: 5/5 expected FAIL because correlation/projections/trade API did not exist.

Verdict: `DAY6_TASK5_RED = PROVEN`.

## First implementation GREEN

Exact head: `09f80768c2491f70e9796990f982cec44ddb73af`

Inherited CI: `31319055557` — all four jobs PASS.

Dedicated PostgreSQL workflow: `31319055577` — Task-5 trade suite 5/5 PASS.

This proved the canonical trade correlation, exact trade/state/candle/metric projection and cursor API behavior. Source review then found two interface gaps that were not accepted for merge: the Drizzle schema did not yet expose the migration-added Task-5 fields, and Token/New-feed did not expose the supported new projections.

## Source-conformance RED — proven

Exact head: `a59ff8e3303efc26777498aa2b1f944b97b5a227`

Inherited CI: `31319230281`

- prior active Day-6 behavior remained healthy;
- only the new typed-schema conformance assertion failed.

Dedicated PostgreSQL workflow: `31319230299`

- 6/8 tests PASS;
- exact state/candle/metric math remained GREEN;
- only typed schema and Token/New-feed enrichment assertions failed as intended.

Verdict: `DAY6_TASK5_SOURCE_CONFORMANCE_RED = PROVEN`.

## Source-conformance GREEN implementation candidate

Exact implementation head: `c0ad021ceb3588c4a995a627f167d86cd00aa84d`

Inherited CI: `31319458045`

All four jobs PASS with real steps, including:

- bootstrap validation;
- frozen-lockfile install and supply-chain policy checks;
- repository validation;
- active Day-6 runtime tests;
- compile-time event contract;
- root typecheck;
- workspace build;
- tracked-tree cleanliness;
- exact Foundry ABI drift check and Solidity tests;
- inherited PostgreSQL/Redis infrastructure regression.

Dedicated Task-5 workflow: `31319458039`

- PostgreSQL ready: PASS;
- Redis `PONG`: PASS;
- `tests/day6/trade-vertical.test.ts`: 5/5 PASS;
- `tests/day6/trade-conformance.test.ts`: 3/3 PASS;
- total: **8/8 PASS**.

## Proven Task-5 behavior

- Trade identity derives only from canonical `CurveBuy` / `CurveSell` event identity.
- Missing or ambiguous mandatory BUY context fails normalization before checkpoint advancement.
- BUY offered quote, actual spent, refund, base fee, creator tax, opening tax and net curve input are exact integers.
- SELL net quote out and gross curve quote (`quoteOut + fee + creatorTax`) are exact integers.
- BUY price = `netCurveInput / tokensOut`; SELL price = `grossCurveQuoteOut / tokensIn` as exact numerator/denominator pairs.
- BUY user-visible quote volume uses actual spent; SELL volume uses gross curve quote.
- `launch_state` reconstructs tracked quote/tokens, fee balances and real/virtual reserves from accepted contract transitions.
- 1m, 5m and 1h candles are deterministic and rational; no binary floating-point price source exists.
- Rolling 5m/1h/24h quote volume and 1h/24h trade-count/unique-trader metrics are deterministic relative to canonical event timestamps.
- The exported Drizzle schema matches the Task-5 SQL migration.
- `/v1/tokens/:address/trades` validates addresses/cursors before DB access, uses reverse `(blockNumber, transactionIndex, logIndex)` ordering, bounded `limit + 1` keyset pagination, and has no RPC fallback.
- Token and New-feed responses expose only supported indexed Task-5 metrics/state; unavailable holder/DEX/current-graduated-price fields are not fabricated.
- Task-5 projections execute within the existing Task-3 journal/projection/checkpoint transaction boundary.

## Scope review

PR #45 changed only Task-5 trade/indexer/read-model/API/test/workflow surfaces. No Task-6 FeeEscrow/admin/graduation reducer was introduced. No centralized trade server, transaction submission, signing, relaying, queueing or key custody was introduced.

## Current gate

The implementation head is source-conformant and GREEN, but guarded acceptance is not yet claimed because this evidence file and `docs/current-build-state.yaml` intentionally move the PR head.

Required next gate:

1. freeze the documentation-bearing PR head;
2. run fresh exact-head inherited CI and the dedicated Task-5 PostgreSQL workflow;
3. require both to PASS;
4. verify `main` did not move from `ab2f4e600d7f73c44fb4ec67875f2da9ff94d6d9`;
5. guarded-merge PR #45 with expected-head protection;
6. verify merged `main`;
7. create and integrate a docs-only Task-5 durable handoff before Task 6 starts.

`DAY6_TASK5_IMPLEMENTATION_GREEN = PROVEN`

`DAY6_TASK5_GUARDED_ACCEPTANCE = NOT_CLAIMED_PENDING_DOCS_BEARING_EXACT_HEAD_CI_AND_MERGE`
