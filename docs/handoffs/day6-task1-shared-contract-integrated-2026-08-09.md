# Day 6 Task 1 — Shared Protocol Contract Integrated Handoff

Date: 2026-08-09

## Integrated baseline

Day-6 Task 1 is integrated on `main`.

- Accepted Task-1 baseline: `81db147ef7be8191981fb10afd425fa4f2f0e280`
- PR: `#37`
- Merge-authorizing exact head: `caec91f99eaf65131c5bff8cc782557493d9b22d`
- Merge-authorizing exact-head CI: `31308934879`
- Guarded merge commit: `bac95f6cb844673d8568add100b1e42a3a363e38`
- Merged `main` was verified identical to that merge commit immediately after integration.

`DAY6_TASK1_SHARED_PROTOCOL_CONTRACT_INTEGRATED_PASS`

## What Task 1 froze

The integrated shared contract provides:

- canonical event identity from `chainId + transactionHash + logIndex`;
- the approved indexed API transport envelope `{ data, meta, page? }`;
- shared reconciliation report types;
- strict network/deployment manifest parsing;
- fail-closed `resolveProtocolContext()` behavior for unresolved deployment values;
- generated Foundry-artifact ABI registry plus deterministic drift checking;
- canonical / known-ignored / unknown event classification;
- explicit stack-version ABI binding with no default/latest-stack fallback;
- exact discriminated canonical event payload types with Solidity integers normalized to `bigint`;
- canonical Day-6 runtime test command plus compile-time shared-contract type assertions in CI.

The generated ABI registry remains artifact-derived only. No ABI entry was manually invented.

## Evidence chain

### Original RED

`docs/evidence/day6-task1-shared-contract-red.md`

- initial RED head `aaf1ab20c5502d8f56d2738f1df906c73bbc9a92`, CI `31288048867`;
- expanded RED head `df8f1a6b315d06622855cbf6b2a1b2da7125ae56`, CI `31288144341`.

### Local exact verification

`docs/evidence/day6-task1-shared-contract-local-verification.md`

The pinned local gate passed validation, bootstrap tests, focused Day-6 tests, typecheck/build, exact ABI generation/check, 35 Foundry suites / 201 tests, and PostgreSQL/Redis health checks. Generated ABI SHA-256:

`cbc7593265f813421cf20488c21a7f1f051c40bc5d3ca10ae17055bfb28debe4`

### Source/design conformance repair

`docs/evidence/day6-task1-source-conformance-repair.md`

Two gaps found during final review were closed by RED -> GREEN evidence:

1. stack-version-aware decoding:
   - RED `da7691ee8da3e292661d225cb2a330013bc795da`, CI `31308285690`;
   - GREEN `20019393fcc13e0c429114d9bb0a3cce083c6838`, CI `31308374528`.
2. discriminated normalized event payload types:
   - valid RED `34fe6a976245b58c693a1d6816f4a40fa273b890`, CI `31308522489`;
   - GREEN `0745a18d46f493853fd857a7d287391561d655d7`, CI `31308563167`.

### Final exact-head integration gate

Workflow `31308934879` on exact head `caec91f99eaf65131c5bff8cc782557493d9b22d` passed all four jobs with real steps:

- bootstrap validation;
- dependency build, including `pnpm test:day6`, compile-time event type assertions, typecheck/build and clean-tree verification;
- Foundry build, ABI drift check and Solidity tests;
- PostgreSQL/Redis infrastructure health.

PR #37 was then guarded-merged with expected-head protection at `bac95f6cb844673d8568add100b1e42a3a363e38`.

## External runner incident disposition

The earlier zero-step GitHub Actions attempts were an external runner-entitlement execution blocker. They were not treated as code failures or PASS evidence. Runner execution recovered before the merge-authorizing exact-head CI. No repository gate was waived.

## Authority and scope unchanged

Task 1 does not change the Day-6 authority model:

- chain/contracts remain financial authority;
- PostgreSQL/indexer/Redis/API remain deterministic rebuildable read projections only;
- wallet transaction submission remains direct client-to-contract;
- no production economics/admin addresses were inferred;
- no Arc mainnet or canonical DEX values were invented;
- no Pons parity/audit conclusion was invented;
- no Buyback event surface was fabricated.

Existing release blockers remain release blockers and are not reopened by Task 1.

## Exact next lane

After this handoff itself is integrated with exact-head CI and guarded merge, Day-6 Task 2 may start from the resulting `main`.

Task 2 scope is limited to the accepted plan's SDK wallet transaction builders, simulation, approved-error decoding, and exact RetryGraduation mapping. It must begin RED-first and must not broaden into the Task-3 DB/indexer transaction boundary.

`DAY6_TASK2 = BLOCKED_UNTIL_THIS_HANDOFF_IS_INTEGRATED`
