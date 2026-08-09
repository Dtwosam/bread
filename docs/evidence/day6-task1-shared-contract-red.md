# Day 6 Task 1 — Shared Protocol Contract RED Evidence

Date: 2026-08-09

Baseline before Day-6 production implementation:

`81db147ef7be8191981fb10afd425fa4f2f0e280`

Branch:

`agent/day6-task1-shared-protocol-contract`

Draft PR:

`#37`

## Initial RED

Head: `aaf1ab20c5502d8f56d2738f1df906c73bbc9a92`

CI: `31288048867`

Focused command:

`pnpm exec vitest run tests/day6/shared-contract.test.ts`

Result: `3 tests / 3 failed`.

All three failures were the intended missing-export assertions:

- `canonicalEventId` absent from `@bread/types`;
- `resolveProtocolContext` absent from `@bread/protocol-sdk`;
- `classifyBreadLog` absent from `@bread/protocol-sdk`.

Existing repository validation and bootstrap tests passed before the focused RED step.

## Expanded RED

Head: `df8f1a6b315d06622855cbf6b2a1b2da7125ae56`

CI: `31288144341`

Focused command:

`pnpm exec vitest run tests/day6/shared-contract.test.ts`

Result: `4 tests / 4 failed`.

The expanded RED proved the missing behavior for:

1. stable `chainId + transactionHash + logIndex` event identity;
2. strict manifest parsing + unresolved-deployment rejection;
3. canonical / known-ignored / unknown event classification;
4. a generated ABI registry containing all accepted core contract roles.

Before that focused failure:

- `pnpm validate` PASS;
- existing `pnpm test` PASS (`9/9` bootstrap tests).

The failures were assertion failures for the missing Day-6 behavior, not broken imports, syntax errors, or unrelated regressions.

## TDD consequence

`DAY6_TASK1_SHARED_CONTRACT_RED = PROVEN`

Minimal GREEN implementation is authorized on this same isolated branch. No Task-1 PASS or merge may be claimed until focused tests, typecheck/build, exact Foundry ABI drift verification, and adjacent repository regressions are freshly green.
