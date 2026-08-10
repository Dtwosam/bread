# Day 8 — Attack the System — Durable Handoff

Date: 2026-08-10

## Verdict

`DAY_8_ATTACK_SYSTEM_INTEGRATED_PASS_DURABLE_CANDIDATE`

This handoff is a docs-only durability candidate. Day 8 becomes durably closed only after this branch is validated, merged into `main`, and read back from actual merged `main`.

## Accepted implementation baseline

- Day-7 durable baseline: `b3c7d7b51ec9398f3b786c795a4f625b8020580a`
- Day-8 implementation PR: #84
- Day-8 final reviewed implementation head: `6ababe6504a6954625b38e80b0c963faaba2de0c`
- Day-8 implementation merge: `ef9b677e883ae7bd2a6969cefc771ad1c83e236c`
- Verified actual `main` immediately after merge: identical to `ef9b677e883ae7bd2a6969cefc771ad1c83e236c`

The PR merge occurred concurrently/external to the active ChatGPT merge sequence, but GitHub confirms it merged the exact reviewed head and no intervening commit entered `main`.

## Source-conforming Day-8 scope

Day 8 remained attack/stabilization work only:

- extended financial fuzz/invariants;
- pinned Solidity static analysis plus manual triage;
- malicious metadata/CSP/signing-target checks;
- RPC/API/indexer/realtime failure injection and recovery;
- bot/search/cache-loss/DB-pressure load behavior;
- 10,000-client hot-launch capacity and realtime fanout;
- bounded redundant RPC failover;
- bounded idempotent indexer outage catch-up.

No product feature, protocol economics, custody/signing authority, financial mutation API, wallet transaction path, canonical address, Arc mainnet value or production economics value was introduced.

## Exact implementation-head evidence

All evidence below ran against `6ababe6504a6954625b38e80b0c963faaba2de0c` and completed PASS.

### Day 8

- Lane 1 extended invariants — run `31430771947`
  - 35 Solidity suites / 201 tests
  - fuzz runs: 4096
  - invariant runs: 256
  - invariant depth: 64
  - generated ABI identity preserved
- Lane 2 static/manual security — run `31430771932`
  - Slither 0.11.6 pinned in CI
  - reviewed High/Medium fingerprint enforced
  - no open critical/high Bread financial issue
- Lane 3 frontend security — run `31430772007`
- Lane 4 failure/recovery — run `31430771994`
- Lane 5 cache-budget unit — run `31430771992`
- Lane 5 indexer catch-up — run `31430771948`
  - deterministic outage backlog block 100 -> 315
  - +15 sustained-arrival blocks during catch-up
  - five bounded replay cycles
  - already-caught-up replay executes no extra apply
  - no-progress path fails closed
  - indexer TypeScript project PASS
- Lane 5 integrated hot-launch/capacity — run `31430771980`
  - 10,000 preconnected/read-active clients
  - 10,000 hot-token requests over 2 seconds: 10,000 success / 0 failure / 0% error
  - hot-token p95: 221.92 ms
  - representative warmed token p95: 116.84 ms <= 350 ms source target
  - 5,000 feed-stress requests: 0% error
  - representative warmed feed p95: 118.43 ms <= 250 ms source target
  - observed-head source-read amplification: 0 in all measured phases
  - token origin fetches: 9 <= derived cache-epoch budget 12
  - feed origin fetches: 8 <= derived cache-epoch budget 12
  - realtime: 10,000/10,000 deliveries in 23.06 ms, 0 slow-consumer drops, max pending depth 1
  - bot limiter: 1,000 concurrent search takes -> 30 ALLOWED / 970 LIMITED; feed bucket remains isolated
  - RPC failover: 200 concurrent reads; per-provider active calls <= 8; primary failure wave <= 9; no retry multiplication; non-failover errors remain visible
  - retained real Postgres/Redis API capacity suite: 9/9 PASS, including cache loss, feed/hot-token coalescing, search abuse and bounded DB pressure

### Retained Day 6

- Task 5 — `31430771979`
- Task 6 — `31430773002`
- Task 7 — `31430772044`
- Task 8 — `31430772001`
- Task 9 — `31430772037`
- Task 10 — `31430772078`

### Retained Day 7

- Task 1 — `31430772102`
- Task 2 — `31430772002`
- Task 3 — `31430771993`
- Task 4 — `31430772089`
- Task 5 — `31430772061`
- Task 6 — `31430772121`
- Task 7 — `31430771934`
- Task 8 — `31430772015`
- Task 9 — `31430772076`
- Task 10 Playwright — `31430771996`

Root CI — `31430771975` PASS.

## Security / diff review

Production-code changes in PR #84 were confined to:

- `apps/api/src/http-cache.ts`
- `apps/api/src/routes/feed.ts`
- `apps/api/src/routes/status.ts`
- `apps/api/src/routes/token.ts`
- `apps/indexer/src/catch-up.ts`
- `apps/indexer/src/index.ts`
- `apps/indexer/src/rpc-failover.ts`

The API changes only provide source-required shared-cache eligibility for successful public projections while keeping status/error paths `no-store`.

The indexer additions are dependency-injected resilience owners around the already-canonical `LogClient` and `replayOverlap` boundaries. They do not choose provider URLs, network identity, retryable vendor errors, chain-head authority, DB checkpoint authority or event-application semantics.

No Solidity, money math, fee/tax accounting, graduation accounting, FeeEscrow ledger, admin/Guardian authority, wallet/signing/custody path, transaction builder, ABI/address manifest, dependency lockfile or production/mainnet value changed.

## Open blockers — unchanged

- `CURRENT_PONS_FACTORY_SOURCE_PARITY`
- `PONS_V2_RUNTIME_REFERENCE`
- `BREAD_PRODUCTION_ECONOMICS_CONFIG`
- `PONS_AUDIT_FINDINGS`
- `ARC_MAINNET_VALUES`

Day-8 PASS does not waive these public/mainnet truthfulness and release gates.

## Exact continuation boundary

Until this docs-only durability branch is merged and read back:

- Day 8 implementation is integrated on `main`.
- Day 8 durability is pending.
- Day 9 MUST NOT begin.

After durability merge/readback, the next permitted lane is **Day 9 — Release Candidate & Rehearsal** from the verified durable Day-8 `main`, with no feature invention and all release/mainnet blockers preserved.
