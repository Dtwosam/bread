# Day 6 Task 2 — Direct-Wallet SDK Builders Evidence

Date: 2026-08-09
Branch: `agent/day6-task2-sdk-builders`
PR: `#39`
Accepted baseline: `5583ad078515aa24b1f994f710297e47512002b4`

## Scope

Task 2 implements only the accepted Day-6 SDK wallet-preparation lane:

- Launch;
- Launch + Buy;
- Buy;
- Sell;
- FeeEscrow Claim;
- canonical-state RetryGraduation;
- PublicClient simulation;
- registered Bread custom-error decoding.

Prepared transaction objects are signer-free and contain no account, private key, wallet client, signer, relay, queue, or server-submission surface. Every prepared Bread financial transaction has `value: 0n`. Task 3 DB/indexer work is not included.

This evidence does not yet claim integrated Task-2 PASS. The documentation-bearing final head must still pass exact-head GitHub CI and guarded merge.

## Original RED

The first test draft imported `viem` from the repository root. pnpm's strict workspace resolution correctly rejected that test-harness assumption. That attempt is not counted as RED behavior evidence.

The harness was corrected to resolve viem from `@bread/protocol-sdk`'s own dependency boundary.

Valid RED:

- head: `7bce7c24bf5a070ead0a3e4092b325cdbbb59c47`;
- CI: `31309322507`;
- existing Task-1 shared-contract suite: 5 PASS;
- Task-2 builder suite: 6 FAIL;
- all six failures were the intended missing SDK exports/behaviors.

`DAY6_TASK2_ORIGINAL_RED = PROVEN`

## Initial GREEN

Initial implementation added signer-free direct-wallet preparation, simulation, and error decoding.

- head: `e8a623a398cd94b1debc8a88887940901a39df0e`;
- CI: `31309395419`;
- all four CI jobs PASS.

The initial prepared-request contract included exact target, ABI, function name, args, `value: 0n`, and optional allowance metadata for Buy/Sell. Simulation received the account separately and delegated only to `PublicClient.simulateContract`.

## Conformance repair 1 — canonical RetryGraduation state reads

### Finding

The initial GREEN accepted caller-supplied graduation phase/readiness. The accepted Task-2 plan requires the SDK itself to read canonical contract state before deciding the retry action.

### RED

A dedicated canonical-read suite was added.

- head: `1d5c30413d2b913cc9b73465db7eebfd35f05cf6`;
- CI: `31309473732`;
- existing 11 Day-6 runtime tests PASS;
- 3 new canonical-read tests FAIL because the old helper never called `readContract`.

### GREEN

`prepareRetryGraduation(client, context, { token })` now reads:

1. `GraduationCoordinator.getGraduation(token)`;
2. for `NOT_GRADUATED`, `Factory.getLaunch(token)` to resolve the canonical curve;
3. `curve.readyToGraduate()` before preparing `sweep(token)`.

Exact mapping:

- `NOT_GRADUATED` + canonical curve ready → `sweep(token)`;
- `NOT_GRADUATED` + not ready → explicit error, no tx;
- `SWEPT` → `createPool(token)`;
- `POOL_CREATED` → terminal `ALREADY_COMPLETE`, no tx;
- `RESCUED` → terminal `RESCUED`, no tx;
- invalid record/phase or missing curve → explicit fail-closed error.

GREEN:

- head: `237db987580ac717637d58a1ebac053275221dc4`;
- CI: `31309585061`;
- all four jobs PASS;
- Day-6 runtime suite: 14 PASS at this checkpoint.

`DAY6_TASK2_CANONICAL_RETRY_GRADUATION = PASS`

## Conformance repair 2 — exact unknown-error fallback

### Finding

The accepted Task-2 plan names the unknown revert fallback exactly `UnknownBreadError`. The initial implementation used `UNKNOWN_REVERT`.

### RED

- head: `ac67eb8fde89cb3ec2ed049aef89d9aba43bd893`;
- CI: `31309673964`;
- Day-6 runtime suite: 13 PASS / 1 FAIL;
- the only failure was the fallback-name mismatch.

### GREEN

The decoder now returns `{ errorName: 'UnknownBreadError', data }` when revert data is unknown or cannot be uniquely attributed to one registered Bread contract role.

The SDK implementation was also structurally aligned to the accepted plan by moving the verified builder implementation to `packages/protocol-sdk/src/builders.ts` and deleting the superseded `transactions.ts`, without behavior change.

- head: `815c679579cb35bf21934b82a0ed5f1ddfec5c7e`;
- CI: `31309759546`;
- all four jobs PASS.

`DAY6_TASK2_UNKNOWN_ERROR_FALLBACK = PASS`

## Final ABI-surface verification

The canonical RetryGraduation implementation depends on artifact-derived ABI coverage for its reads and writes. The generator allowlist already includes `readyToGraduate`; a direct runtime registry assertion was added to remove ambiguity and prove the checked-in generated registry contains every Task-2 function used:

- Factory: `launchToken`, `launchTokenAndBuy`, `getLaunch`;
- Curve: `buy`, `sell`, `readyToGraduate`;
- FeeEscrow: `claim`;
- Coordinator: `getGraduation`, `sweep`, `createPool`.

Current implementation/conformance head before this documentation checkpoint:

- head: `a9c76285d7a5f7d7b6bdd5ea947453a6113ceef1`;
- CI: `31309866936`;
- all four jobs PASS with real steps.

Exact dependency-build results on that head:

- `pnpm install --frozen-lockfile`: PASS, 321 supply-chain-policy entries verified;
- `pnpm validate`: PASS, all nine validation lines;
- `pnpm test`: 9 PASS / 0 FAIL;
- `pnpm test:day6`: 3 files, 15 PASS / 0 FAIL;
  - `tests/day6/sdk-builders.test.ts`: 6 PASS;
  - `tests/day6/shared-contract.test.ts`: 5 PASS;
  - `tests/day6/sdk-retry-graduation.test.ts`: 4 PASS;
- compile-time shared-contract type assertions: PASS;
- formatting gate: PASS;
- `pnpm typecheck`: PASS;
- `pnpm build`: PASS across participating workspaces;
- clean tracked workspace check: PASS;
- Foundry build: PASS;
- generated Bread ABI drift check: PASS;
- Solidity tests: PASS;
- PostgreSQL/Redis infrastructure health and clean-down: PASS.

`DAY6_TASK2_SOURCE_DESIGN_CONFORMANCE = IMPLEMENTATION_GREEN_FINAL_DOCS_HEAD_CI_PENDING`

## Final SDK behavior frozen by Task 2

- Launch/Launch+Buy prepare direct Factory calls.
- Buy/Sell prepare direct launch-curve calls.
- Claim prepares direct FeeEscrow overloads.
- All prepared financial calls use `value: 0n`.
- Buy allowance metadata points USDC → curve for exact `quoteIn`.
- Sell allowance metadata points launch token → curve for exact `tokensIn`.
- Prepared requests contain no signer/account/private-key/server-submit state.
- Account is supplied only to simulation.
- RetryGraduation derives phase/readiness from canonical contract reads and never collapses `sweep` and `createPool` into one transaction.
- Known custom errors are decoded only from the stack-bound generated registry.
- Unknown/ambiguous reverts preserve raw data under `UnknownBreadError`.

## Scope preserved

Task 2 does not add or alter:

- DB/indexer schemas or transactional projection logic;
- server-side transaction submission, signing, relaying, or key custody;
- production economics/admin values;
- Arc mainnet values;
- canonical Arc DEX activation values;
- Pons parity/audit conclusions;
- financial authority outside the chain/contracts;
- a fabricated Buyback event surface.

## Pre-merge disposition

`DAY6_TASK2_DIRECT_WALLET_SDK_BUILDERS = IMPLEMENTATION_AND_SOURCE_CONFORMANCE_GREEN`

`DAY6_TASK2_INTEGRATED_PASS = NOT_CLAIMED_PENDING_FINAL_EXACT_HEAD_CI_AND_GUARDED_MERGE`

`DAY6_TASK3 = BLOCKED_BY_TASK2_ACCEPTANCE_GATE`
