# Bread Component Sourcing & Reuse Gate

Status: CONTROLLING FOR EXTERNAL COMPONENT RESEARCH DURING IMPLEMENTATION
Date: 2026-08-08

## Purpose

When a required Bread behavior is not sufficiently specified by the verified Pons source, Bread may research and selectively reuse or adapt a component from another launchpad or mature DeFi protocol. This is a sourcing aid only. It does not create permission to build standalone mini-products, import another protocol's economics, or bypass Bread's source hierarchy, security invariants, continuity doctrine, or unresolved blockers.

## Source priority

For each required capability:

1. Use verified Pons source when it exists and is applicable.
2. If the required Pons source is missing or insufficient, research mature open-source launchpads implementing the same primitive.
3. If no suitable launchpad implementation exists, research battle-tested DeFi/security primitives and libraries.
4. If no candidate meets Bread's requirements, design a minimal Bread-specific implementation under the existing security and financial invariants.

Current-live Pons parity must never be claimed from a third-party implementation.

## Candidate acceptance record

No external implementation may enter Bread until its candidate record includes:

- repository and exact immutable commit/tag;
- exact source path(s);
- license and whether reuse/modification is permitted;
- audit/review history when available;
- deployment/production history when verifiable;
- dependency surface and privileged roles;
- asset/decimal assumptions;
- accounting model and rounding rules;
- external-call/reentrancy/failure behavior;
- upgrade/admin/custody assumptions;
- tests/invariants available upstream;
- known incidents or material caveats found during research;
- semantic differences from Bread/Pons;
- recommendation: REUSE, ADAPT, REFERENCE_ONLY, or REJECT.

Public code without a suitable license is REFERENCE_ONLY unless permission is separately established.

## No economic inheritance

External components supply implementation ideas or reusable primitives, not protocol truth. Bread must not silently inherit another project's:

- fee percentages or recipient splits;
- bonding-curve economics;
- launch/graduation thresholds;
- snipe-tax schedule;
- token supply/allocation policy;
- admin powers;
- custody model;
- DEX routing assumptions;
- chain-specific addresses or decimal conventions.

Bread's verified source hierarchy, Arc/USDC constraints, fork delta and financial/security invariants remain controlling.

## Continuous-system integration rule

A sourced component is a temporary lane inside one continuously evolving Bread system. It is never accepted as a standalone entity.

Every sourced-component lane must start from the current green integration baseline and must define an impact map before implementation:

- upstream inputs/interfaces;
- owned code/change boundary;
- downstream consumers already present in Bread;
- affected financial/security invariant IDs;
- canonical events/errors/types/ABI changes;
- migration/versioning impact;
- exact regression and consumer-compatibility tests.

As soon as the sourced capability has a stable interface, it must be wired into every already-existing downstream Bread layer that should consume it. No late-integration phase is permitted.

The vertical continuity path is:

`onchain behavior/event -> protocol SDK -> indexer projection -> API -> web/operator state -> E2E/reconciliation`

Only the layers that already exist and are applicable at the current build stage must be wired immediately. Future layers receive a frozen handoff interface + representative fixture/consumer test and must consume that interface when their lane starts rather than redefining it.

## Sourced component PASS definition

A sourced component may not PASS merely because its local tests or its upstream project's tests pass.

PASS requires all of the following:

1. source/license/provenance gate passes;
2. semantics are explicitly reconciled against Bread's controlling sources;
3. focused unit/fuzz/invariant tests pass;
4. required Bread-specific security tests pass;
5. canonical interface/events/types are established once, without duplicate copies;
6. all already-existing affected downstream consumers are wired;
7. cross-lane consumer compatibility tests pass;
8. affected prior regressions remain green;
9. no unresolved interface drift or placeholder economics remain;
10. clean integrated commit becomes the next Bread baseline;
11. current-build-state and evidence are updated.

`LOCAL_COMPONENT_PASS != BREAD_PASS`.

## Money-path rule

External money-path code receives the same two-stage review as original Bread money-path code. Reuse does not lower scrutiny.

For fee/escrow/trading/buyback/launch/graduation components, review must explicitly cover:

- conservation/solvency;
- rounding and dust;
- double-credit/double-claim prevention;
- reentrancy and callback behavior;
- failed transfer/retry semantics;
- donation resistance where relevant;
- access control/admin authority;
- recipient mutation/recovery behavior;
- fee-on-transfer/nonstandard token assumptions;
- DoS/griefing surfaces;
- upgradeability/storage risks if any.

## FeeEscrow-specific continuity example

If Bread selects or adapts an external FeeEscrow, the lane cannot stop at an escrow contract test. Before PASS it must also prove the Bread trade-fee handoff and any currently existing canonical consumer path. As later SDK/indexer/API/creator-dashboard layers are introduced, they must consume the frozen escrow credit/claim semantics rather than inventing parallel accounting.

The escrow's local accounting must reconcile to Bread's tracked fee state and financial invariants. Another launchpad's fee percentages or recipient policy must not be imported merely because its escrow code is reused.

## Blocker rule

A third-party component can close a missing-source blocker only through an explicit Bread reimplementation/adaptation decision backed by this gate and the controlling source documents. It does not prove current-live Pons parity.

Existing blockers remain active unless a dedicated checkpoint explicitly closes them with evidence.

## Research output

Before Day-3 money-path implementation, produce a candidate matrix for the currently missing/uncertain components, starting with:

- FeeEscrow;
- FeePolicy/fee splitting where Pons semantics remain incomplete;
- Launch+Buy;
- snipe protection;
- any later missing Pons component encountered during implementation.

For each candidate, record REUSE / ADAPT / REFERENCE_ONLY / REJECT and why. Implementation begins only after the selected component has an approved Bread integration design.
