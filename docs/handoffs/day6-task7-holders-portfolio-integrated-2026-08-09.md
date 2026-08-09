# Day 6 Task 7 — Holder Snapshots & Portfolio Read Model — Integrated Handoff

Date: 2026-08-09

## Durable baseline

- Implementation PR: #49
- Durable handoff PR: #50
- Task-6 durable baseline: `17aa7f6ceb7b742305ae5ff06791444a2e1d6d45`
- Final Task-7 branch head: `1bd392035392738bb41657bbc87d7273db7bec5e`
- Guarded implementation merge: `311cb84cf33f54e03c7c91fe01dd80408aa9ff91`
- `main` was verified identical to the merge commit immediately after merge.

## Exact-head verification

All merge-authorizing workflows on `1bd392035392738bb41657bbc87d7273db7bec5e` completed successfully:

- inherited repository CI: `31325546267` — all four jobs PASS with real steps;
- retained Task-5 trade/PostgreSQL regression: `31325546283` — PASS;
- retained Task-6 fees/admin/graduation PostgreSQL regression: `31325546269` — PASS;
- dedicated Task-7 holder/portfolio PostgreSQL workflow: `31325546309` — PASS, 8/8 tests.

## Integrated behavior

- canonical launch-token `Transfer` is the holder-mutation source;
- constructor mint, ordinary transfer and burn reconstruct exact balances;
- overlap replay does not double-apply holder effects;
- negative projected balances fail as integrity errors inside the atomic journal/projection/checkpoint transaction;
- `Approval` is an explicit holdings no-op;
- same-range constructor mint is classified before `LaunchCreated` persistence using normalized launch identities;
- known protocol addresses remain visible and are explicitly tagged;
- Top-10 concentration excludes protocol addresses without inventing an additional percentage formula;
- `/v1/tokens/:address/holders` is DB-only, freshness-bearing, bounded and versioned-cursor paginated;
- `/v1/portfolio/:address` is DB-only, freshness-bearing and versioned-cursor paginated;
- no average-entry or PnL is fabricated;
- graduated current price/value remains explicitly unavailable without a separately ratified live DEX-price source.

## Defects caught before integration

- Holder pagination originally ordered the text alias `balance` lexicographically. The query now explicitly orders the underlying numeric `h.balance`, with a permanent regression test.
- A TypeScript package-boundary issue was repaired by keeping the holder projector on the DB-owned canonical event contract and validating Transfer payload structure fail-closed.
- An added conformance fixture initially reused protocol addresses across roles; that was a test-fixture error, not product RED, and was replaced with globally unique fixture addresses.

## Authority / safety boundary

- Chain/contracts remain financial authority.
- PostgreSQL/indexer/API remain deterministic rebuildable read projections only.
- No raw-RPC wallet-balance fallback was introduced.
- No server signing, submission, relaying, queueing, custody or financial-write authority was introduced.
- Task-8 replay/finality/cache/fanout behavior is not implemented here.

## Task-7 verdict

`DAY6_TASK7_HOLDERS_PORTFOLIO_INTEGRATED_PASS`

Implementation is integrated. Handoff PR #50 must itself pass inherited exact-head CI plus retained Task-5, Task-6 and Task-7 dedicated regressions and guarded-merge before Task 8 begins.

## Next safe action

After PR #50 is exact-head green and merged, start Day-6 Task 8 from the new `main` baseline, RED-first, limited to replay/finality/cache/fanout:

- overlap replay idempotency across the integrated projection set;
- checkpoint block-hash contradiction fail-closed handling;
- post-commit-only cache invalidation and logical-channel fanout;
- realtime dedupe/refetch semantics without per-browser chain subscriptions;
- no rebuild/reconciliation or broader API/search/concurrency work owned by later tasks unless the accepted plan explicitly assigns it to Task 8.

Task 9+ API/search/concurrency and Task 10 rebuild/reconciliation remain blocked until their predecessor lanes are durably integrated.