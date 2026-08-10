# Day 9 — Release Candidate & Rehearsal Execution Plan

Date: 2026-08-10
Baseline: `fe9b13f1ce271fd5423fdd76de13034dac18fee1`
Branch: `agent/day9-release-candidate-rehearsal`

## Source-controlled objective

Day 9 is the release-candidate/rehearsal lane defined by the ratified Bread source pack. It is stabilization and operational proof only: no new product feature, economics model, wallet authority, financial ledger, transaction relay, custody model, or inferred production/mainnet configuration is authorized.

The Day-9 end gate is:

- empty environment → usable launchpad PASS;
- rollback PASS;
- rebuild/reconcile PASS;
- supported browser/device/wallet/accessibility matrix PASS.

A release-candidate tag is not evidence by itself. The exact candidate commit must remain immutable while its deployment, smoke, rollback, reconciliation, administration, browser/device/wallet, source/security, and retained-continuity evidence is collected.

## Verified starting state

- Day 8 is durably closed on `main` at `fe9b13f1ce271fd5423fdd76de13034dac18fee1`.
- The Arc testnet network manifest has canonical chain ID `5042002` and canonical six-decimal USDC `0x3600000000000000000000000000000000000000`, but its DEX dependency is intentionally unresolved.
- `config/deployments/arc-testnet.day5.json` remains `BLOCKED_UNTIL_VERIFIED_DEX_AND_PRODUCTION_CONFIG`; no core deployment, adapter, Protocol Admin, Guardian, economics hash, DEX evidence hash, or deployment start block is claimed.
- Current external verification has not established an official/canonical Uniswap V3/V4 deployment on Arc. No address may be inferred from another chain or from an unofficial source.
- Production administration remains source-bound to a contract multisig model; the deploy script refuses an EOA Protocol Admin.
- Existing production-style deploy/configure/verify/smoke scripts are fail-closed and must remain the Bread deployment authority.
- Existing Day-6 rebuild/reconcile logic already owns REC-01 through REC-06 and destructive-target safety; Day 9 must invoke it rather than create a second reconciliation path.
- Existing Day-7 Playwright proves Chromium desktop/mobile and bounded Firefox/WebKit browser engines, but it explicitly does not constitute the full Day-9 physical-device/wallet matrix.

## Hard boundaries

1. Do not populate the canonical Arc testnet deployment manifest with guessed DEX/admin/economics values.
2. Do not use Playwright fake deployment addresses as chain deployment evidence.
3. Do not label controlled/local/test-only contracts as canonical Arc/Uniswap/Safe deployments.
4. Do not weaken the deploy script's economics hash, DEX evidence hash, contract-admin, ownership-handoff, or code-verification requirements.
5. Do not create a second indexer rebuild/reconciliation implementation.
6. Do not create server-side signing, transaction relay, user key custody, or financial mutation APIs.
7. Do not claim physical-device or wallet-browser coverage from desktop browser emulation.
8. Do not create an RC tag until the pre-RC candidate and environment authority gates below are closed.
9. Existing blockers remain unchanged: `CURRENT_PONS_FACTORY_SOURCE_PARITY`, `PONS_V2_RUNTIME_REFERENCE`, `BREAD_PRODUCTION_ECONOMICS_CONFIG`, `PONS_AUDIT_FINDINGS`, `ARC_MAINNET_VALUES`.

## Lane 0 — Source/environment authority reconciliation

Purpose: prove which Day-9 environment facts are authoritative before any deployment.

### 0A. Arc network endpoint reconciliation

- Compare `config/networks/arc-testnet.json` with current official Arc documentation.
- Add a focused RED only if the checked-in RPC/WS/explorer facts are demonstrably stale.
- Minimum GREEN may update testnet network metadata only to current official values; canonical chain ID and USDC identity must remain exact.
- Mainnet remains unresolved until official publication.

### 0B. DEX dependency gate

- Search only official Arc and official DEX deployment sources for an Arc testnet V3/V4 deployment.
- If an official deployment exists, record exact source provenance and independently verify runtime bytecode before using it.
- If none exists, preserve `UNRESOLVED_TESTNET_ADAPTER` in the canonical manifest and mark live canonical-DEX RC deployment blocked.
- A controlled rehearsal DEX may be used only inside an unmistakable Day-9 test-only rehearsal environment; it must never be written into the canonical Arc deployment manifest or called canonical.

### 0C. Protocol Admin / Safe gate

- Verify whether an official Safe deployment is available on Arc testnet.
- If available, independently verify the relevant Safe contracts and use a 2-of-3 testnet Safe for the Protocol Admin drill.
- If unavailable, do not invent a canonical Safe address. A controlled test-only multisig/admin fixture may be used for local/ephemeral rehearsal only and must be labelled as such; the real Arc-testnet multisig rehearsal remains blocked until the required Safe deployment exists or is explicitly deployed/verified through the official Safe process.

### Lane-0 exit

Produce one machine-readable environment-authority report separating:

- `OFFICIAL_VERIFIED` facts;
- `TEST_ONLY_REHEARSAL` facts;
- `UNRESOLVED_BLOCKER` facts.

No RC tag or live deployment is allowed before this report passes.

## Lane 1 — Immutable RC candidate and clean-environment rehearsal harness

Purpose: prove the empty-environment → usable-launchpad sequence without changing financial authority.

### 1A. Freeze candidate

- Start from latest integrated Day-9 branch head after Lane 0.
- Run root CI + retained Day-6/7/8 gates.
- Create an RC candidate tag only after that exact commit is green and Lane-0 authority is resolved for the chosen rehearsal mode.
- Tag must identify source commit and must not imply production/mainnet readiness.

### 1B. Rehearsal environment profile

Implement a separate, explicit test-only rehearsal profile rather than editing `config/deployments/arc-testnet.day5.json` to fake completion.

The profile must contain:

- network identity and provenance;
- explicit `TEST_ONLY_REHEARSAL` status;
- exact deployment source commit;
- test-only DEX/admin dependency provenance when applicable;
- exact economics/config digest using explicit test values;
- deployment-start block;
- generated core addresses only after actual deployment;
- no production/mainnet authority claim.

### 1C. Production-script deployment

Use the existing `DeployDay5Graduation.s.sol` as the Bread stack authority. The rehearsal wrapper may supply explicit test-only dependencies and values, but may not duplicate contract deployment/wiring logic.

The rehearsal must prove:

- deployment key matches declared ephemeral deployment authority;
- Protocol Admin is a contract;
- nonzero exact economics and DEX-evidence hashes;
- full stack deployment/wiring;
- coordinator authorization;
- launch activation only after wiring;
- ownership handoff to Protocol Admin;
- deployer retains no long-lived privileged role.

### 1D. Verify and smoke

Reuse/extend existing configure/verify/smoke boundaries so actual deployed code/config/ownership is checked before any lifecycle smoke.

Smoke sequence must cover the source-defined path as applicable to the rehearsal environment:

`deploy → wire → verify → launch → buy → sell → claim → graduate → verify permanent lock → reconcile USDC`.

Any missing step becomes a focused RED before extension; do not replace the established Day-5/Day-6 authority.

## Lane 2 — Rollback rehearsal

Purpose: prove web/API/indexer rollback without changing financial contracts.

Build a deterministic release-slot rehearsal around immutable version identities:

- frontend current/candidate slots and rollback;
- API current/candidate slots and rollback;
- indexer current/candidate process stop/restart/rollback;
- database projection compatibility/rebuild rule explicit;
- contracts remain unchanged throughout rollback;
- cached/public reads fail/degrade safely during transitions;
- submitted transaction recovery remains available after frontend rollback.

Required assertions:

- rollback selects a previously verified immutable artifact, never an unpinned image/build;
- rollback does not mutate contract addresses/economics/ownership;
- API/indexer rollback cannot make projection state financial authority;
- rollback completes with health/readiness checks and user-facing degraded state where needed.

## Lane 3 — Rebuild/reconcile rehearsal

Purpose: execute the existing Day-6 recovery authority against the rehearsal stack.

Reuse `runIndexerCli()` / `rebuildStack()` / `reconcileStack()` and REC-01…REC-06.

Prove:

- destructive rebuild target is `LOCAL_TEST` or `ISOLATED_REPLACEMENT` before deletion;
- replay begins from exact deployment start block;
- canonical event identities and checkpoint continuity match;
- FeeEscrow custody/outstanding reconcile;
- curve and graduation state reconcile;
- runtime code hashes/network/quote identity reconcile;
- rebuild cannot report PASS without authoritative reconciliation PASS;
- deterministic rebuild report is retained in the Day-9 evidence bundle.

## Lane 4 — Protocol Admin / Guardian operational drills

Purpose: rehearse permissions and recovery without weakening 05B/05C.

Required drills in the chosen verified rehearsal environment:

1. Guardian increases restrictions only.
2. Guardian cannot reduce restrictions, change economics, move funds, or replace admin.
3. Protocol Admin clears restrictions after review.
4. Pause new launches.
5. Escalate buy/trading pause and restore normal operation.
6. Rotate Guardian; old Guardian loses authority.
7. Rehearse multisig signer recovery/rotation while preserving threshold/ownership policy.
8. Verify long-lived owners remain the Protocol Admin contract and no ordinary EOA owns production-style admin surfaces.

Where a real Safe is unavailable, local/test-only fixture drills may prove Bread contract semantics but must not be labelled as the full testnet multisig drill.

## Lane 5 — Supported browser/device/wallet/accessibility matrix

Purpose: extend Day-7 browser proof into the explicit Day-9 support matrix.

### Automated browser layer

Retain full Chromium desktop/mobile journeys and expand bounded engine coverage where deterministic automation is valid:

- Chromium desktop;
- Firefox desktop;
- WebKit desktop-Safari engine approximation;
- Chromium Android device profile;
- keyboard/focus/accessibility assertions;
- mobile software-keyboard pressure;
- wallet connect/wrong-network/switch/transaction recovery.

Do not call WebKit-on-Linux a physical macOS Safari proof.

### Manual/real-device evidence slots

The evidence bundle must carry explicit slots for:

- current Safari on macOS;
- current and previous-major iOS Safari where practical;
- current Android Chrome on a representative mid-range device;
- each explicitly supported wallet in-app browser/path.

A slot is `PASS`, `BLOCKED`, or `NOT_SUPPORTED`; it is never silently inferred from emulation. Day-9 supported-matrix PASS requires every advertised/supported slot to be PASS or explicitly removed from the supported set through a source/product decision.

## Lane 6 — Evidence bundle and final RC closeout

Create one durable Day-9 evidence bundle containing:

- exact source/main/candidate/tag identities;
- environment-authority report;
- dependency provenance;
- deployment transaction hashes / deployment-start block when a live rehearsal is executed;
- runtime code/config/ownership verification;
- lifecycle smoke results;
- rollback report;
- rebuild/reconcile report including REC-01…REC-06;
- Protocol Admin/Guardian drill report;
- browser/device/wallet/accessibility matrix;
- retained root/Day-6/Day-7/Day-8 regression matrix;
- source/security diff review;
- unchanged release/mainnet blockers and their typed scopes.

## Verification discipline

Every demonstrated gap follows:

1. source-backed requirement;
2. focused RED;
3. verify intended failure;
4. minimum GREEN;
5. focused + adjacent regression;
6. full exact-head integration matrix;
7. source/security diff review;
8. guarded merge only from the exact reviewed SHA.

No workflow/config/setup failure counts as a behavioral RED.

## Merge and durability sequence

1. Keep the Day-9 implementation PR draft while lanes are active.
2. Final exact implementation head must pass all required Day-9 lanes plus retained root/Day-6/Day-7/Day-8 gates.
3. Update PR with exact evidence, mark ready, and guarded-merge exact head only if `main` still matches the reviewed base or all intervening changes are reconciled.
4. Verify actual merged `main`.
5. Create a separate docs-only Day-9 durability handoff/current-state PR.
6. Prove its exact-head continuity/browser matrix and code equivalence to implementation main.
7. Guarded-merge and read back actual `main`, current-build-state, and Day-9 handoff before Day 10.

## Current preflight verdict

`DAY9_PREFLIGHT_PLAN_FROZEN`

`LIVE_CANONICAL_ARC_TESTNET_RC_DEPLOYMENT = BLOCKED_PENDING_VERIFIED_DEX_AND_PROTOCOL_ADMIN_DEPENDENCIES`

`CONTROLLED_TEST_ONLY_REHEARSAL = AUTHORIZED_ONLY_WITH_EXPLICIT_TEST_ONLY_PROVENANCE_AND_NO_CANONICAL/PRODUCTION CLAIM`

`RC_TAG = NOT_AUTHORIZED_UNTIL_LANE_0_AND_PRE_RC_EXACT_HEAD_GATES_PASS`
