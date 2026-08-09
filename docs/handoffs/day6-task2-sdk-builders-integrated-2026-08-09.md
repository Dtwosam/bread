# Day 6 Task 2 — Direct-Wallet SDK Builders Integrated Handoff

Date: 2026-08-09

## Integrated baseline

Day-6 Task 2 is integrated on `main`.

- Accepted Task-2 baseline: `5583ad078515aa24b1f994f710297e47512002b4`
- Implementation PR: `#39`
- Merge-authorizing exact head: `6ceeecf0bb47d5f4db859e5625b563d76135ce0c`
- Merge-authorizing exact-head CI: `31310005756`
- Guarded merge commit: `15ab27b73b9a3355f95dd7cfc290e6e538d16aff`
- Merged `main` was verified identical to that merge commit immediately after integration.

`DAY6_TASK2_DIRECT_WALLET_SDK_BUILDERS_INTEGRATED_PASS`

## What Task 2 froze

The integrated SDK contract now provides:

- signer-free prepared transactions for Launch, Launch+Buy, Buy, Sell, Claim, and RetryGraduation;
- direct wallet-to-contract destinations with `value: 0n` for Bread financial calls;
- exact Buy/Sell allowance metadata without server-side custody;
- PublicClient simulation with the account supplied only at simulation time;
- canonical RetryGraduation state reads from Coordinator, Factory, and the launch curve;
- exact retry mapping: `NOT_GRADUATED + ready -> sweep`, `SWEPT -> createPool`, `POOL_CREATED -> terminal already-complete`, `RESCUED -> terminal rescued`;
- stack-bound registered Bread custom-error decoding;
- exact unknown/ambiguous fallback `{ errorName: 'UnknownBreadError', data }`;
- artifact-derived ABI coverage assertions for every Task-2 read/write function.

No prepared request contains a private key, signer, wallet client, relay, queue, or centralized transaction-submission field.

## Evidence chain

Durable evidence:

`docs/evidence/day6-task2-sdk-builders.md`

### Original RED

- valid RED head `7bce7c24bf5a070ead0a3e4092b325cdbbb59c47`;
- CI `31309322507`;
- Task-1 shared-contract suite remained green;
- Task-2 builder suite failed only on the six missing behaviors.

### Initial GREEN

- head `e8a623a398cd94b1debc8a88887940901a39df0e`;
- CI `31309395419`;
- all four jobs PASS.

### Canonical RetryGraduation repair

- RED `1d5c30413d2b913cc9b73465db7eebfd35f05cf6`, CI `31309473732`;
- GREEN `237db987580ac717637d58a1ebac053275221dc4`, CI `31309585061`.

The SDK no longer trusts caller-supplied phase/readiness. It reads canonical contract state before choosing a retry action.

### Exact unknown-error fallback repair

- RED `ac67eb8fde89cb3ec2ed049aef89d9aba43bd893`, CI `31309673964`;
- GREEN/structural alignment `815c679579cb35bf21934b82a0ed5f1ddfec5c7e`, CI `31309759546`.

The fallback is exact `UnknownBreadError`, and the accepted SDK implementation lives in `packages/protocol-sdk/src/builders.ts`.

### Final implementation/source-conformance checkpoint

- pre-docs head `a9c76285d7a5f7d7b6bdd5ea947453a6113ceef1`;
- CI `31309866936`;
- 15 Day-6 runtime tests PASS across 3 files;
- compile-time shared-contract assertions PASS;
- typecheck/build/clean-tree PASS;
- Foundry/ABI PASS;
- PostgreSQL/Redis infrastructure PASS;
- artifact-derived ABI coverage explicitly proves Factory/Curve/FeeEscrow/Coordinator functions used by Task 2 are present.

### Final guarded integration gate

Documentation-bearing exact head `6ceeecf0bb47d5f4db859e5625b563d76135ce0c` ran workflow `31310005756`.

All four jobs passed with real steps:

- `bootstrap-validation`: PASS;
- `dependency-build`: PASS, including frozen install, validation, bootstrap tests, `pnpm test:day6`, compile-time type assertions, formatting, root typecheck, root build, and clean tracked-tree verification;
- `foundry-bootstrap`: PASS, including compile, generated ABI drift check, and Solidity tests;
- `infrastructure-health`: PASS, including PostgreSQL/Redis probes and clean shutdown.

PR #39 was then guarded-merged with expected-head protection at `15ab27b73b9a3355f95dd7cfc290e6e538d16aff`.

## Authority and scope unchanged

Task 2 does not change the Day-6 authority model:

- chain/contracts remain financial authority;
- PostgreSQL/indexer/Redis/API remain deterministic rebuildable read projections only;
- wallet signing and transaction submission remain client-owned;
- no server-side signing, relaying, queueing, or key custody exists;
- no production economics/admin values were inferred;
- no Arc mainnet or canonical DEX values were invented;
- no Pons parity/audit conclusion was invented;
- no Buyback event surface was fabricated.

Existing release blockers remain release blockers and are not reopened by Task 2.

## Exact next lane

This handoff itself must pass exact-head CI and guarded merge before Day-6 Task 3 begins.

After that integration, Task 3 may start from the resulting `main` and is limited to the accepted plan's PostgreSQL event journal/projection schema and atomic journal + projection + checkpoint transaction boundary. It must start RED-first and must not broaden into Task 4 launch projection logic before its own acceptance gate.

`DAY6_TASK3 = BLOCKED_UNTIL_THIS_HANDOFF_IS_INTEGRATED`
