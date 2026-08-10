# Day 8 — Attack the System Closeout Handoff

Date: 2026-08-10

## Durable verdict

`DAY_8_ATTACK_SYSTEM_INTEGRATED_PASS_DURABLE`

This is the small/current 06H continuation pointer for Day 8. The verdict becomes the accepted repository continuity state only when the separate docs-only durability PR is exact-head green, guarded-merged, and the resulting `main` plus this handoff and `docs/current-build-state.yaml` are freshly read back.

## Accepted implementation boundary

- Repository: `Dtwosam/bread`
- Starting durable Day-7 main: `b3c7d7b51ec9398f3b786c795a4f625b8020580a`
- Day-8 implementation PR: #84
- Exact audited implementation head: `6ababe6504a6954625b38e80b0c963faaba2de0c`
- Guarded implementation merge / verified post-implementation `main`: `ef9b677e883ae7bd2a6969cefc771ad1c83e236c`
- Lane-1/Lane-2 evidence: `docs/evidence/day8-lane1-lane2-security.md`
- Controlling plan: `docs/superpowers/plans/2026-08-10-day8-attack-system.md`
- Durability branch: `docs/day8-attack-system-durable-handoff`
- Durability PR: #85

## What Day 8 proved

- Extended financial fuzz/invariant execution passed over the accepted contract system without requiring a production Solidity change.
- Slither 0.11.6 was pinned and its High/Medium fingerprint was explicitly triaged rather than globally suppressed; no open Critical/High financial issue remained after source-to-sink review.
- Malicious metadata, external URL, CSP/sanitization, wallet/provider and frontend-signing boundaries passed focused adversarial tests.
- Failure injection and recovery stayed aligned with the 05D runbook, including cache loss, DB pressure, API/indexer degradation and bounded RPC failover behavior.
- Public read projections gained source-aligned shared-cache policy while status/error paths remain `no-store`; no financial authority moved into the cache, API or indexer.
- Bot-polling isolation, retained search-abuse/cache-loss/DB-pressure loads and bounded RPC failover passed before the hot-launch proof.
- A bounded indexer catch-up controller proved sustained-arrival recovery while reusing the existing replay/apply authority and failing closed on checkpoint/head regression or no durable progress.
- The hot-launch gate exercised 10,000 preconnected/read-active clients and 10,000 hot-token requests behind shared-cache edge frontends without viewer-linear observed-head/RPC growth.
- Representative cached token/feed latency remained under the carried-forward 04D/06I p95 targets.
- Realtime fanout delivered to 10,000 subscribers without slow-consumer drops in the healthy fast-consumer case.
- Retained Day-6 backend and Day-7 browser/product journeys stayed green on the same exact Day-8 implementation head.

## Demonstrated repairs and bounded additions

Day 8 changed only demonstrated stabilization/security/capacity boundaries:

1. Added explicit public-projection cache headers (`s-maxage=1`) and `no-store` on operational/error paths so edge caching can absorb repeat bursts without caching unsafe state.
2. Added a bounded, caller-configured RPC failover primitive. Provider identity, network authority, retry policy inputs and log-consumption authority remain with existing callers; Bread owns only bounded concurrency/queueing/circuit/failover mechanics.
3. Added a bounded indexer catch-up controller that reuses the existing replay/apply boundary; caller-owned head/checkpoint/application authority is preserved.
4. Corrected the capacity harness so origin-refresh budgets derive from the authoritative shared-cache TTL and bounded arrival-window cache epochs instead of a timing-fragile magic constant. The budget remains O(edge/cache epochs), never O(viewers).
5. Corrected the RPC-failover stress assertion to its deterministic bounded failure wave (`maxConcurrent + failureThreshold - 1`) while still forbidding retry amplification.
6. Added permanent bot-polling, cache-loss, DB-pressure, indexer-catch-up, RPC-failover, cache-policy and malicious-frontend regressions.

No production economics, financial formula, custody model, wallet-send authority, transaction lifecycle, recovery owner, ABI/address authority, server-side user transaction relay, Pons runtime numeric value, Arc mainnet value or canonical DEX address was added or inferred.

## Exact implementation-head verification

At `6ababe6504a6954625b38e80b0c963faaba2de0c`:

### Day 8

- Lane 1 extended invariants `31430771947` — PASS
  - Foundry v1.5.0
  - 35 suites / 201 passed / 0 failed
  - fuzz runs: 4,096
  - invariant profile: 256 runs × depth 64
  - generated ABI exactness PASS
- Lane 2 static security `31430771932` — PASS
- Lane 3 frontend security `31430772007` — PASS
- Lane 4 failure/recovery `31430771994` — PASS
- Lane 5 cache-budget unit `31430771992` — PASS
- Lane 5 sustained-arrival indexer catch-up + indexer `tsc -b` `31430771948` — PASS
- Lane 5 integrated hot-launch/bot/cache-loss/DB-pressure/RPC-failover capacity `31430771980` — PASS
  - preconnected clients: 10,000
  - hot-token requests: 10,000
  - success / failure: 10,000 / 0
  - healthy-read error rate: 0%
  - bounded hot-launch arrival window: 2,000ms
  - hot-token stress p95: ~221.92ms
  - representative cached token p95: ~116.84ms (target <=350ms)
  - representative cached feed p95: ~118.43ms (target <=250ms)
  - hot-token origin fetches: 9 / derived budget 12
  - feed origin fetches: 8 / derived budget 12
  - observed-head/RPC deltas: 0 for hot stress, feed stress and representative reads
  - realtime: 10,000 subscribers / 10,000 deliveries / ~23.06ms publish / 0 slow-consumer drops

### Retained integration

- root CI `31430771975` — PASS
- Day-6 Task 5 `31430771979` — PASS
- Day-6 Task 6 `31430773002` — PASS
- Day-6 Task 7 `31430772044` — PASS
- Day-6 Task 8 `31430772001` — PASS
- Day-6 Task 9 `31430772037` — PASS
- Day-6 Task 10 `31430772078` — PASS
- Day-7 Task 1 `31430772102` — PASS
- Day-7 Task 2 `31430772002` — PASS
- Day-7 Task 3 `31430771993` — PASS
- Day-7 Task 4 `31430772089` — PASS
- Day-7 Task 5 `31430772061` — PASS
- Day-7 Task 6 `31430772121` — PASS
- Day-7 Task 7 `31430771934` — PASS
- Day-7 Task 8 `31430772015` — PASS
- Day-7 Task 9 `31430772076` — PASS
- Day-7 Task 10 Playwright desktop/mobile primary journeys + canonical-manifest restoration `31430771996` — PASS

## Final source/security review

The implementation diff was reviewed against durable Day-7 main before merge.

- no production Solidity/economics change;
- no new financial ledger or database authority;
- no centralized user signing/submission/custody path;
- no second wallet, transaction lifecycle or recovery store;
- public API changes are read-cache policy only;
- indexer failover/catch-up additions preserve caller-owned provider, head, checkpoint and application authority;
- all pre-existing release blockers remain in force.

## Unchanged blockers

- `CURRENT_PONS_FACTORY_SOURCE_PARITY`
- `PONS_V2_RUNTIME_REFERENCE`
- `BREAD_PRODUCTION_ECONOMICS_CONFIG`
- `PONS_AUDIT_FINDINGS`
- `ARC_MAINNET_VALUES`

Their typed scopes remain unchanged. Day 8 does not authorize production economics, unrestricted public funds, an exact-current Pons parity claim or guessed Arc mainnet/canonical DEX values.

## Next safe action after durability merge

Begin **Day 9 — RC Deployment & Browser/Wallet Matrix** only after durability PR #85 is exact-head green, guarded-merged and freshly read back from `main`.

Day 9 is an RC/testnet rehearsal lane, not permission to clear the remaining production/mainnet blockers. Preserve the same financial, wallet, transaction, indexer/API and release authority boundaries while executing the source-defined deployment rehearsal, browser/wallet/device matrix and final RC evidence.
