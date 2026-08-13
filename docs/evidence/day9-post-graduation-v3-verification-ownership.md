# Day 9 — post-graduation V3 verification ownership

Status: **BROWSER MATRIX OWNED / ROOT VITEST CI OWNERSHIP GAP OPEN**

This evidence records where the post-graduation V3 verification is currently owned. It does not claim exact-head PASS.

## Browser ownership

`.github/workflows/day9-lane6-browser-matrix.yml` already owns the full Day-9 browser spec and fixture trees:

- `apps/web/e2e/specs/**`
- `apps/web/e2e/fixtures/**`
- `apps/web/**`

Its execution step runs the complete Day-9 Playwright release configuration:

`pnpm --filter @bread/web exec playwright test --config=e2e/playwright.day9-release.config.ts`

Therefore `apps/web/e2e/specs/graduated-v3-trading.spec.ts` is already part of the established Lane-6 browser gate. No new browser workflow or parallel runner is required.

## Root CI ownership gap

The normal `.github/workflows/ci.yml` dependency-build job currently runs:

- repository validation;
- bootstrap tests;
- the full Day-6 Vitest suite;
- shared Day-6 contract type checking;
- workspace typecheck and build.

It does not currently execute the new Day-9 post-graduation V3 Vitest contracts.

The required focused Day-9 set is:

- `tests/day9/arc-testnet-environment-reconciliation.test.ts`
- `tests/day9/post-graduation-v3-context.test.ts`
- `tests/day9/post-graduation-v3-trading.test.ts`
- `tests/day9/post-graduation-v3-route.test.ts`
- `tests/day9/post-graduation-v3-execution.test.ts`
- `tests/day9/post-graduation-v3-boundaries.test.ts`
- `tests/day9/post-graduation-canonical-review.test.ts`
- `tests/day9/post-graduation-v3-controller.test.ts`
- `tests/day9/post-graduation-v3-ui-review.test.ts`
- `tests/day9/post-graduation-v3-ui-execution.test.ts`
- retained `tests/day6/sdk-builders.test.ts`

The direct-module boundary suite covers source-required adversarial classes that were not explicit in the earlier execution contract: one-unit input, 6-decimal rounding, non-1:1 pool-price orientation, near-total price impact, invalid quote/slot0 state, negative minimum output, and non-positive classic-router deadline.

A minimal normal GitHub update was attempted to add the focused Vitest set to the existing `dependency-build` job. The connected GitHub safety layer blocked that workflow write. No wrapper workflow, Git-object plumbing, alternate branch trick, or other bypass was used.

## Packaging relationship

`tests/day9/post-graduation-v3-execution.test.ts` intentionally requires `prepareV3ExactInputTrade` from the protocol SDK root export. The builder exists in `packages/protocol-sdk/src/v3-trading.ts`, but exposing that transaction-builder symbol through `packages/protocol-sdk/src/index.ts` is independently blocked by the same connected-tool safety boundary.

The verification contract must not be weakened merely to make CI green. Until the SDK-root export is added through an allowed path, the focused execution test remains a real packaging gate.

## Existing exact-head release-matrix ownership

`docs/evidence/day9-exact-head-local-release-matrix.md` shows that the established exact-head release matrix is an ordered composition of existing repository commands and Day-9 lanes rather than one dedicated monolithic runner. The final RC workflow is a truthfulness/evidence gate; it is not the behavioral test executor.

Therefore the correct long-term ownership is:

- root `ci.yml` dependency-build → focused post-graduation V3 Vitest/typecheck/build verification;
- Day-9 Lane 6 browser matrix → graduated Router02 browser execution proof;
- final RC gate → retained blocked/PASS verdict truthfulness only.

## Current classification

`POST_GRADUATION_V3_BROWSER_GATE_OWNED_ROOT_VITEST_CI_OWNERSHIP_BLOCKED_BY_CONNECTED_TOOL_SAFETY`

This is an implementation/verification ownership gap, not a Bread runtime failure and not a PASS.
