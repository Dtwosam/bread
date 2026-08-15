# Post-Graduation V3 Indexing — Zero-Output Swap Semantics Addendum

Date: 2026-08-13
Status: SOURCE-COMPATIBLE SECURITY/CORRECTNESS ADDENDUM
Applies to: `docs/superpowers/specs/2026-08-13-post-graduation-v3-trade-indexing-design.md`

## Why this addendum exists

The original V3 indexing design required every normalized pool `Swap` to have exactly one positive and one negative signed pool delta and treated zero-delta shapes as malformed.

Upstream Uniswap V3 core semantics require a narrower rule.

Primary upstream contract/math behavior:

- `IUniswapV3PoolEvents.Swap` exposes signed `amount0` / `amount1` pool-balance deltas.
- `UniswapV3Pool.swap()` requires nonzero `amountSpecified`, but the exact-input path subtracts `amountIn + feeAmount` from the remaining input and emits the final `Swap` even when calculated output rounds to zero.
- `SwapMath.computeSwapStep()` computes `amountRemainingLessFee = floor(amountRemaining * (1_000_000 - feePips) / 1_000_000)`.
- For a sufficiently tiny exact input, that fee-adjusted amount can be zero. The zero-input sqrt-price helper leaves the price unchanged, `amountIn`/`amountOut` for the price move are zero, and the remaining input is consumed as `feeAmount`.

For the current Arc-Testnet V3 fee tier `3000`, an exact input of one smallest unit is a concrete example: the fee-adjusted input floors to zero and the emitted pool deltas can therefore be `(positive input, 0 output)` in the appropriate token ordering.

If Bread rejected every one-zero canonical `Swap` by failing the whole indexing range, any actor able to trade against the verified graduated pool could intentionally submit a dust swap and repeatedly halt the indexer. That is an unacceptable external-venue denial-of-service surface.

## Corrected V3 Swap disposition rule

Every `Swap` from an exact verified Bread graduated pool remains canonical event evidence and must be journaled/reconciled by its ordinary `(chainId, transactionHash, logIndex)` identity.

After decoding signed deltas, classify it into one of these dispositions.

### 1. Normal priced trade

Accepted when:

- exactly one pool delta is strictly positive; and
- the other pool delta is strictly negative.

Then:

- infer BUY/SELL from the verified TOKEN/USDC token0/token1 ordering;
- normalize exact positive input / negative output absolute values into `quoteAmount` and `tokenAmount`;
- fetch/deduplicate `transaction.from` for actor attribution;
- create the venue-neutral `trades` row;
- update shared candles, price, volume, trade counts and creator trade count;
- never mutate Bread curve reserve accounting.

### 2. Canonical zero-output dust swap — journal only

Accepted when:

- exactly one pool delta is strictly positive; and
- the other pool delta is exactly zero.

This is a canonical V3 event but **not** a priced Bread trade projection.

Required behavior:

- journal the exact `V3_POOL / Swap` event, including raw topics/data and decoded signed deltas;
- retain explicit token/curve launch association;
- do not insert a `trades` row;
- do not update candles, latest execution price, quote/base volume, trade counts, unique-trader counts or creator trade count;
- do not fabricate an execution-price numerator/denominator;
- transaction-sender lookup is unnecessary unless another audited consumer requires it, because no normalized trade actor is being projected;
- overlap replay remains idempotent through the journal PK;
- `REC-06` authoritative identity scanning **must include** this journal-only Swap identity;
- rebuild must reproduce the same journal-only disposition deterministically.

This is not a silent drop: the event is retained as canonical journal evidence and its no-trade projection disposition is explicit and tested.

### 3. Invalid/malformed Swap — fail the range

Fail closed for shapes that cannot represent the upstream semantics Bread accepts, including:

- both deltas zero;
- both deltas strictly positive;
- both deltas strictly negative;
- one delta strictly negative while the other is zero (output without positive pool input);
- unsafe/out-of-range integer decoding;
- decoded/raw log contradiction;
- pool/token registry contradiction.

## Security boundary

A third-party venue event may not be allowed to turn harmless external dust activity into a durable Bread ingestion outage merely because the event does not produce a meaningful token/quote price.

Conversely, Bread must not convert zero-output fee-only activity into market price, volume, trader-count or creator-count data.

The chain remains source of truth; Bread records the canonical event and projects only the financial/read-model semantics that are actually well-defined.

## TDD amendments

When the repository RED execution surface is available, amend the V3 Swap RED coverage to prove:

1. ordinary BUY/SELL with opposite nonzero signs still normalizes exactly;
2. `amount0 > 0, amount1 = 0` is retained journal-only and does not halt the range;
3. `amount0 = 0, amount1 > 0` is retained journal-only and does not halt the range;
4. journal-only dust produces no trade/candle/metric/creator-count effect;
5. replay of the same dust identity does not duplicate journal state;
6. authoritative reconciliation includes the dust identity;
7. both-zero, same-sign nonzero, and negative-plus-zero malformed cases fail closed.

The previously planned blanket requirement that every accepted `Swap` have one positive and one negative delta is superseded by this addendum.

## Unchanged boundaries

This addendum does not change:

- protocol economics or V3 fee tier;
- Bread trade write routing;
- custody or authority;
- the single normalized `trades` ledger for actual priced trades;
- the requirement to journal exact verified-pool Swap evidence;
- the no-live-BTST-write rule for this indexing lane;
- PR #93 draft/unmerged status, Day-9 incompleteness, RC prohibition or Day-10 gate.
