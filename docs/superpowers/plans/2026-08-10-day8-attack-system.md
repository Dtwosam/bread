# Bread Day 8 — Attack the System Execution Plan

Date: 2026-08-10
Baseline: `b3c7d7b51ec9398f3b786c795a4f625b8020580a`
Branch: `agent/day8-attack-system`

## Controlling sources

Day 8 consumes the ratified v1.5 Bread Source Pack and the durable Day-7 integrated baseline. The controlling Day-8 requirements are 05A–05D, 06C–06I, the master Source of Truth, and `docs/current-build-state.yaml` v1.47.

The Day-8 end gate is:

- no open critical/high financial issue;
- extended invariants PASS;
- capacity/load targets PASS;
- recovery behavior matches the incident/recovery runbook.

Days 8–10 are stabilization/rehearsal/security/load work. Day 8 does not invent product features, economics, authority, addresses, or a new financial/runtime state owner.

## Preserved authorities and hard boundaries

- Arc chain remains authoritative for financial state.
- Bread API/indexer/Redis remain non-authoritative projections/caches.
- Ordinary user writes remain wallet/provider -> Arc; no Bread trade relay or backend signing key.
- Existing canonical financial math, FeePolicy/FeeEscrow, launch, graduation, transaction persistence/recovery, ABI/address/config and admin/guardian boundaries remain owners.
- No production economics, Pons runtime numeric values, Arc mainnet values or canonical DEX addresses may be inferred.
- `CURRENT_PONS_FACTORY_SOURCE_PARITY`, `PONS_V2_RUNTIME_REFERENCE`, `BREAD_PRODUCTION_ECONOMICS_CONFIG`, `PONS_AUDIT_FINDINGS`, and `ARC_MAINNET_VALUES` remain unchanged blockers with their v1.47 scopes.
- A failed financial invariant is a hard release blocker.
- Any demonstrated gap is repaired through RED -> verified expected failure -> minimum GREEN -> focused/adjacent/integrated regression.

## Preflight inventory already established

- Existing Foundry profile: Solidity 0.8.26, fuzz runs 256, invariant profile 64 runs x depth 32.
- Existing financial/adversarial tests include bonding-curve math, tiny-trade, trading, FeeEscrow, final-buy, opening-protection and Day-4 invariant/security suites.
- Existing Day-6 tests already cover first concurrent API/read/replay/cache/fanout behavior and rebuild/reconciliation.
- Existing Day-7 browser suite covers degraded reads, transaction recovery, mobile trade, wallet/network, launch and claim.
- Existing dependency-free load harness is `scripts/load/hot-launch-smoke.mjs`, but it currently drives one URL only and therefore cannot establish the full 06I release gate.
- No existing Slither/Aderyn/Semgrep integration was found during preflight. Static-analysis tooling must therefore be handled as a separately pinned/proven security-tool step; no casual dependency upgrade is permitted.

## Lane order

The lanes are serial where evidence or interfaces depend on previous results. Each accepted lane becomes the next integrated baseline before a dependent lane proceeds.

### Lane 1 — Extended financial invariants and adversarial contract security

Goal: attack every new/reconstructed money path under the full 05A/05C threat model, without rewriting accepted financial semantics.

Impact map:

- upstream: Days 2–5 contracts and their accepted snapshots/invariants;
- owners: contracts + Foundry tests only unless a real defect crosses a public interface;
- downstream regressions: generated ABI check, protocol SDK compilation, Day-6/Day-7 financial consumers;
- invariants: INV-001–006, 010–012, 020–026, 030–035 as applicable, 040–044, 050–056, 060–064.

Attack matrix:

- 0/1/max and 6-decimal boundaries;
- repeated tiny trades / rounding extraction;
- final crossing buy below/at/above boundary;
- donations and tracked-reserve manipulation;
- reentrancy/adversarial recipients and failed token transfers where applicable;
- FeeEscrow unauthorized credit, double claim, donation separation, failed claim rollback and solvency;
- immutable launch economics under later policy/config change;
- Launch+Buy rollback/refund/custody cleanup;
- opening-tax bounds/monotonicity/exemption/routing;
- graduation wrong dependency, failed external stages, retry, duplicate-liquidity/double-sweep, dust and lock escape;
- emergency-state changes during user preparation/execution.

Execution:

1. Run existing contract suites at baseline as a control.
2. Raise fuzz/invariant intensity in a Day-8-specific command/config without weakening the default suite.
3. Add only missing adversarial properties as RED tests.
4. Verify each intended RED before a production repair.
5. Minimum owning repairs only.
6. Rerun all affected invariants plus full contracts suite and ABI generation/check.

### Lane 2 — Static analysis + focused manual money-code review + privileged abuse

Goal: satisfy the explicit static-analysis requirement and attack authority/asset-movement surfaces from 05A/05B.

Static-tool rule:

- First probe existing runner/toolchain availability.
- If a suitable analyzer is absent, select one narrowly scoped, pinned version from its primary upstream distribution/documentation and record provenance/version/install command.
- Tool installation is CI/security tooling, not an application dependency; do not alter Bread runtime/package economics or silently accept analyzer suppressions.
- Findings are triaged against Bread source semantics. High/critical plausible findings block the lane until reproduced/validated/repaired or documented as demonstrably false-positive with evidence.

Manual review focus:

- arbitrary external call/approval/withdraw surfaces;
- reentrancy/state-before-external-call ordering;
- role assignment and role-revocation paths;
- Guardian monotonic restriction only;
- Protocol Admin unpause/recovery only within frozen authority;
- no single ordinary EOA production ownership assumption in deployment handoff fixtures;
- existing-launch snapshot immutability;
- rescue/recovery exact state/time predicates;
- adapter/locker escape paths;
- source/manifest/generated-ABI integrity.

Required abuse tests:

- Guardian cannot unpause, move assets, rewrite economics, recipient, quote asset, adapter or launch timestamp;
- non-admin cannot reduce restrictions or execute admin recovery;
- admin cannot mint launch supply, seize arbitrary balances, drain earned escrow claims or rewrite old-launch economics;
- compromised guardian can cause bounded DoS only, not fund/config authority;
- privileged state transitions emit/retain the canonical evidence required by monitoring/runbooks.

### Lane 3 — Metadata, frontend signing and release-integrity attacks

Goal: attack untrusted metadata/browser boundaries from 05A without redesigning Day-7 UI.

Vectors:

- HTML/script/event-handler payloads in name/symbol/description-like metadata surfaces;
- `javascript:`, `data:`, credential-bearing and malformed external URLs;
- Unicode/impersonation and control characters where displayed;
- broken/hostile image and external-link handling;
- CSP/external-navigation rel safety;
- wrong-network/provider injection and transaction target/recipient/value review integrity;
- no build-time secrets or private signing material in web-exposed config/bundles.

Only demonstrated gaps become permanent regressions and minimum production repairs.

### Lane 4 — RPC/API/indexer/realtime failure injection + recovery/runbook proof

Goal: prove service failures degrade truthfully and recovery follows 05D rather than creating a second state authority.

Failure scenarios:

- primary RPC failure, timeout, rate-limit and disagreement/failover;
- API errors/timeouts/overload and stale non-authoritative data;
- Redis/cache loss and recovery;
- indexer halt/backlog/catch-up, replay/idempotency and event-gap/duplicate handling;
- PostgreSQL pool pressure/temporary unavailability;
- realtime slow consumer/backpressure/disconnect behavior;
- submitted browser transaction refresh recovery;
- failed graduation followed by safe retry;
- guardian restriction escalation and Protocol Admin recovery/unpause in controlled tests.

Runbook assertions:

- failure domain is explicit;
- financial/transaction-critical state fails explicitly rather than appearing authoritatively fresh;
- no recovery invents user-fund movement;
- indexer rebuild/reconcile remains chain-derived and must PASS before declaring recovered;
- transaction recovery uses the canonical persistence owner;
- graduation retry cannot duplicate liquidity/sweep;
- recovery/unpause evidence includes reproduced regression and reconciliation where applicable.

### Lane 5 — 06I integrated capacity / bot-burst / launch-stampede gate

Goal: extend the existing dependency-free load harness into a production-like integrated proof rather than adopting a parallel load subsystem.

Required scenarios:

1. **10k hot launch** — 10,000 concurrent connected/read-active clients concentrate on one new launch.
2. **Bot polling** — repeated token/search/feed requests cannot exhaust DB/RPC.
3. **Realtime burst** — thousands observe one hot token while rapid events fan out with bounded memory/latency.
4. **Cache loss** — Redis restart/loss does not create a thundering herd into Postgres/RPC.
5. **RPC failure under load** — primary failure triggers bounded failover without retry amplification.
6. **Indexer outage/catch-up** — degraded reads remain truthful; replay is idempotent; catch-up is faster than sustained arrival.
7. **DB pressure** — pool saturation yields bounded degradation/errors, not cascading process failure.

Release thresholds:

- at least 10,000 concurrent connected/read-active clients in the hot-launch scenario;
- cached feed API p95 <= 250 ms under representative load;
- token read API p95 <= 350 ms under representative load;
- realtime indexed visibility target about <= 1 second after final Arc event under representative load;
- healthy cached/read request error rate < 1%, excluding intentionally rate-limited abusive requests;
- no uncontrolled memory/socket-buffer/DB-connection/RPC-concurrency/queue growth;
- no viewer-linear Arc RPC multiplication;
- cache loss/RPC failover recover without retry amplification;
- transaction-safety reads remain prioritized or fail explicitly rather than returning stale authoritative-looking state.

Harness design rule:

- Extend `scripts/load/` and existing API/indexer/realtime owners.
- Prefer dependency-free Node tooling and existing Postgres/Redis fixtures unless measurement requirements demonstrate a real need for an additional tool.
- Separate deterministic CI-sized regression scenarios from the explicit 10k production-like gate if runner resource limits require it, but never represent the smaller CI regression as the 10k PASS.
- Record machine-readable measurements and scenario configuration.

### Lane 6 — Day-8 integrated closeout

Required exact-head closeout:

- all Day-8 lane workflows/tests PASS;
- full root CI PASS;
- extended Foundry fuzz/invariants PASS;
- static-analysis findings triaged with no open critical/high financial issue;
- 06I capacity thresholds PASS from production-like evidence;
- recovery/runbook matrix PASS;
- affected Day-6/Day-7 regressions PASS;
- source/security diff review confirms no authority/economics/mainnet drift;
- exact implementation head guarded-merged;
- separate docs-only Day-8 durability handoff/current-build-state update runs its continuity matrix and guarded-merges before Day 9 may begin.

## Initial stop conditions

Stop and surface evidence rather than work around it if:

- a financial invariant requires an architecture/economic change to satisfy;
- static/manual review finds a plausible critical/high issue whose correct repair changes a frozen public/financial interface;
- dependency/network behavior contradicts ratified assumptions;
- the 10k gate cannot be measured honestly in the available environment and requires a deployment/provider decision;
- recovery semantics would require a second ledger/state machine or user-fund custody;
- a production economics/admin/mainnet value becomes necessary;
- an affected prior regression fails after a proposed repair.

## Immediate next action

Create a draft Day-8 PR from this branch, then run **Lane 1 baseline/control + coverage audit** before writing any production change. In parallel, probe static-analyzer availability and inventory the existing load/API/realtime owners. Only demonstrated coverage gaps/failures advance to RED tests.