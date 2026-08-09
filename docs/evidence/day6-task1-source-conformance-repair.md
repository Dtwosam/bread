# Day 6 Task 1 — Source/Design Conformance Repair Evidence

Date: 2026-08-09
PR: #37
Accepted baseline: `81db147ef7be8191981fb10afd425fa4f2f0e280`

## Purpose

After the locally verified Task-1 candidate was pushed, GitHub-hosted runner execution recovered and exact-head CI could execute normally again. A final source/design conformance review was then performed before guarded merge. Two interface gaps were found and repaired through RED -> GREEN evidence rather than waived.

This record does not itself claim guarded Task-1 acceptance. The documentation-bearing final head still requires exact-head CI and guarded merge.

## Recovered exact-head runner execution

Candidate `4a77a7f8cfa41f6b25a0bc880095e58c2aef41e7` ran workflow `31305936831` after runner execution recovered. All four jobs executed real steps and passed:

- `bootstrap-validation`: PASS;
- `dependency-build`: PASS;
- `foundry-bootstrap`: PASS, including generated ABI drift check and Solidity tests;
- `infrastructure-health`: PASS.

The earlier zero-step runs remain historical external-execution evidence only. They are no longer an active repository execution blocker.

## Conformance repair 1 — stack-version-aware ABI decoding

### Finding

The approved Day-6 design requires ABI/event decoding to be stack-version aware and to reject unsupported stack/interface versions explicitly. The previously verified decoder selected the current generated ABI only by contract role, which could allow the newest ABI to be applied without an explicit stack binding.

No canonical production stack-version value is frozen in repository configuration. The accepted factory stores an immutable `bytes32 stackVersion`, and deployment tooling receives `BREAD_STACK_VERSION` externally. Therefore the repair must not hard-code or infer a production version.

### RED

Head: `da7691ee8da3e292661d225cb2a330013bc795da`
Workflow: `31308285690`

Result:

- bootstrap validation: PASS;
- Foundry/ABI: PASS;
- infrastructure: PASS;
- existing focused shared-contract behaviors: 4 PASS;
- new stack-binding behavior: 1 FAIL, exactly because `createBreadStackAbiBinding` was absent.

### GREEN

Implementation heads:

- `7b77fef9587a9540f56f0e0150120d3d251f6375` — explicit stack ABI binding and fail-closed decode check;
- `20019393fcc13e0c429114d9bb0a3cce083c6838` — public SDK export.

Workflow: `31308374528`

Result: all four jobs PASS. The focused shared-contract suite passed 5/5; typecheck, build, clean-tree check, Foundry/ABI and infrastructure all passed.

Disposition:

`DAY6_TASK1_STACK_VERSION_AWARE_DECODING = PASS`

The SDK has no default/latest-stack decode fallback. A caller must carry an explicit ABI binding for the stack identity being decoded, and a mismatched stack is rejected before ABI decoding.

## Conformance repair 2 — discriminated normalized event payloads

### Finding

The accepted Task-1 plan requires `DecodedBreadEvent` to be a discriminated union using actual accepted event names, with every integer payload field represented as `bigint` internally. The previous event wrapper used the accepted event-name union but exposed payload as `Record<string, unknown>`, which did not freeze the downstream accounting interface.

### Type-contract RED

A dedicated compile-time contract test was added at `tests/day6/shared-contract.types.ts` and wired into CI.

The first compile attempt exposed a TypeScript 7 command-line harness requirement (`--ignoreConfig`) and was not treated as behavior RED evidence. After correcting only that harness invocation, valid RED was obtained:

Head: `34fe6a976245b58c693a1d6816f4a40fa273b890`
Workflow: `31308522489`

Exact failing assertions included:

- `CurveBuy.buyer` was `unknown`, not `Address`;
- `CurveBuy.quoteIn` and `tokensOut` were `unknown`, not `bigint`;
- `FeePolicyUpdated.nextPolicy` was `unknown`;
- `GraduationCompleted.poolId`, `positionId`, and `usdcUsed` were untyped;
- `Transfer.from` and `value` were untyped.

All unrelated jobs and the 5/5 runtime shared-contract suite remained green.

### GREEN

Head: `0745a18d46f493853fd857a7d287391561d655d7`
Workflow: `31308563167`

The normalized event contract now defines an exact payload map for the accepted Factory, curve, FeeEscrow, FeePolicy, EmergencyController, GraduationCoordinator, permanent locker, ERC-20 `Transfer`, and inherited `OwnershipTransferred` events. All Solidity integer widths normalize to `bigint`; addresses/bytes32/bools remain explicitly typed.

Result:

- compile-time Day-6 event contract: PASS;
- runtime shared-contract suite: 5/5 PASS;
- root typecheck: PASS;
- root build: PASS;
- clean tracked workspace check: PASS;
- bootstrap validation: PASS;
- Foundry/ABI: PASS;
- infrastructure: PASS.

Disposition:

`DAY6_TASK1_DISCRIMINATED_EVENT_UNION = PASS`

## Final CI command conformance

The accepted plan requires the canonical root `pnpm test:day6` command to be present in CI. The Task-1 workflow now invokes that root command and separately runs the compile-time shared-contract type assertions without removing prior gates.

## Scope preserved

These repairs do not introduce or infer:

- production Bread economics or admin addresses;
- Arc mainnet deployment values;
- a canonical Arc DEX activation value;
- Pons parity or audit conclusions;
- server-side wallet custody or transaction submission;
- DB/indexer/API financial authority;
- a fabricated Buyback event surface.

## Pre-merge disposition

Implementation/source conformance is green through head `0745a18d46f493853fd857a7d287391561d655d7`. The final documentation/CI-wiring head created after this evidence must still execute all four GitHub jobs successfully before PR #37 may be marked ready and guarded-merged.

`DAY6_TASK1_SOURCE_DESIGN_CONFORMANCE = IMPLEMENTATION_GREEN_FINAL_HEAD_CI_PENDING`

`DAY6_TASK1_GUARDED_ACCEPTANCE = NOT_CLAIMED`

`DAY6_TASK2 = BLOCKED_BY_TASK1_ACCEPTANCE_GATE`
