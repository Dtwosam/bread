# Day 7 Task 5 — Trade Preparation, Wallet Lifecycle and Recovery Handoff

Date: 2026-08-10

## Status

`DAY7_TASK5_TRADE_WALLET_TRANSACTION_RECOVERY_IMPLEMENTATION_MERGED_PENDING_DURABLE_HANDOFF`

This is the separate durability handoff for Day-7 Task 5. It is created from the actual guarded implementation merge on `main`; Task 5 does not become durable until this handoff and `docs/current-build-state.yaml` are exact-head green, guarded-merged, and read back from actual `main`.

## Durable start baseline

- Previous durable Day-7 baseline: `6dea2c65004a85735196a97a5b284c4e4077d584`
- Previous durable lane: Day-7 Task 4 — Token Page
- Task-5 implementation PR: #67
- Exact reviewed Task-5 implementation head: `87d55976b51a740046cc70a5984b6b94d7727a4b`
- Guarded Task-5 implementation merge: `7168b0f26daf46bcf4d8a4587088d95a6df92d27`

## What Task 5 integrated

Task 5 extends the accepted Token experience with one direct wallet/provider transaction path. It does not create a second Token-page, financial, transaction, custody or API authority.

- Canonical transaction-critical reread immediately before signing: curve reserves, reserved tokens, trade fee, creator tax and current opening tax.
- SDK-owned deterministic Buy/Sell review using the accepted Bread integer fee/tax/final-fill/refund semantics.
- User-visible expected output, minimum output, base fee, creator tax, opening buy tax, price impact and slippage.
- Final approved-review guard: if the canonical reread changes a reviewed consequence, wallet signature is blocked until the refreshed review is shown.
- SDK Buy/Sell preparation and pre-sign simulation.
- Direct injected-wallet execution through Wagmi/viem; no Bread trade relay or `/v1` mutation route.
- Explicit disconnected, wrong-network and ready states with wallet connect and Arc testnet switch actions.
- Exact ERC-20 allowance handling: approve only the required spend when current allowance is insufficient; require successful approval confirmation before broadcasting the trade.
- Transaction lifecycle covering validation, preparation, signature, submission, confirmation, rejection, revert, replacement and unresolved/unknown recovery.
- Transaction hash persisted before receipt waiting.
- Bounded local reload recovery, chain isolation, replacement-hash continuation and confirmed indexed-read reconciliation.
- Duplicate-action lock retained through unresolved replacement confirmation.
- Shared responsive desktop/tablet/mobile Trade experience, source-defined Buy/Sell presets, software-keyboard-friendly numeric input, accessible live status and accepted touch targets.

## TDD evidence

The Task-5 lane was implemented as small RED -> GREEN slices. The final source/security review also produced one additional meaningful regression RED.

### Transaction state and persistence

- Proved legal state transitions, duplicate-action lockout, immediate hash persistence, reload-recoverable states and network-loss `UNKNOWN` behavior before implementation.

### Trade-review finance boundary

- Proved deterministic Buy/Sell review from accepted curve math and fee order, including final-buy partial-spend/refund behavior.
- The browser consumes this SDK review but does not become chain authority.

### Pre-sign controller

- Proved wrong-network failure before financial reads, current curve-state reread, SDK-derived minimum output and simulation immediately before signature.

### Submission and recovery

- Proved hash persistence before receipt waiting, wallet rejection distinct from mined revert, confirmation reconciliation and transport-loss `UNKNOWN` recovery.
- Proved reload recovery, cross-chain isolation and wallet replacement-hash continuation.

### Final-review guard

- Proved the wallet cannot open from an unseen/stale estimate when the final canonical reread changes reviewed financial consequences.

### Responsive Trade UI

- Proved one shared Trade state owner across desktop, tablet and mobile.
- Proved exact source-defined presets, financial consequence display, accessible live state and minimum touch targets.

### Real wallet runtime

- Proved exact allowance handling, approval confirmation before trade, approval-revert fail-closed behavior, canonical Buy/Sell spendable-balance reads, injected wallet connection, explicit network switching and mounted reload recovery.

### Replacement duplicate-submit race

A source/security review found that `REPLACED` was not originally included in the duplicate-action lock set while the replacement transaction was still unresolved.

- Meaningful RED head: `4adf47bda22f6d45e924413c581b2e7c17aef38b`
- Dedicated RED run: `31371674643`
- RED result: 39/40 assertions passed; only unresolved replacement duplicate-lock failed.
- Minimal GREEN: add `REPLACED` to the active transaction lock set.
- Final reviewed GREEN head: `87d55976b51a740046cc70a5984b6b94d7727a4b`

## Exact-head implementation evidence

All of the following were run against final reviewed implementation head `87d55976b51a740046cc70a5984b6b94d7727a4b`:

- Task-5 dedicated workflow `31371777103`: PASS — 40/40 Task-5 assertions.
- Root CI `31371777350`: PASS — repository validation, full retained Day-6 suite, typecheck, production Next build, clean-tree verification, Foundry and infrastructure checks.
- Day-7 Task-4 Token continuity `31371777093`: PASS.
- Day-7 Task-1 UI foundation `31371777060`: PASS.
- Day-7 Task-2 indexed-read boundary `31371777021`: PASS.
- Retained Day-6 Task 5 `31371777013`: PASS.
- Retained Day-6 Task 6 `31371777022`: PASS.
- Retained Day-6 Task 7 `31371777025`: PASS.
- Retained Day-6 Task 8 `31371777349`: PASS.
- Retained Day-6 Task 9 `31371777158`: PASS.
- Retained Day-6 Task 10 `31371777016`: PASS.

The Day-7 Task-3 shared-types workflow is path-filtered to its own shared-type surface and did not trigger on the final Task-5 head. Its earlier accepted proof is not being represented as a fresh Task-5 exact-head run.

## Source / authority review

`DAY7_TASK5_SOURCE_DESIGN_SECURITY_REVIEW = PASS`

- No Solidity behavior changed in Task 5.
- No API financial-write authority was added.
- No server transaction submission, signing, relaying or custody of user signing material was introduced.
- No indexed/API projection is used as transaction financial authority.
- No second fee, price, custody or transaction ledger was introduced.
- No unlimited approval behavior was introduced.
- Arc testnet network, RPC, explorer and USDC values are consumed from the canonical repository network manifest.
- No Bread production economics/admin values, Arc mainnet values or canonical Arc mainnet DEX addresses were guessed.
- The five existing project-level release/parity blockers remain unchanged.

## Unchanged blockers

- `CURRENT_PONS_FACTORY_SOURCE_PARITY`
- `PONS_V2_RUNTIME_REFERENCE`
- `BREAD_PRODUCTION_ECONOMICS_CONFIG`
- `PONS_AUDIT_FINDINGS`
- `ARC_MAINNET_VALUES`

None is reclassified or bypassed by Task 5.

## Next lane after durable handoff

After this docs-only handoff PR is exact-head green, guarded-merged, and actual `main` is freshly verified, begin:

**Day 7 Task 6 — Create, Review, Launch and Launch+Buy**

Task 6 must start from the resulting Task-5 durable merge and consume the accepted `prepareLaunch`, `prepareLaunchAndBuy`, canonical prepared economics/config authority, and Task-5 transaction controller/recovery rather than inventing parallel transaction semantics.

The first Task-6 RED must prove the source-defined Create/Review contract before implementation:

- only image, name, ticker, description, links, creator tax, buyback and optional initial buy are user-editable;
- protocol-only values such as phantom reserve/tick-spacing equivalents are not exposed as user inputs;
- Review shows the actual prepared supply/quote/economics, creator tax, buyback, initial buy, launch fee, graduation target, creator wallet and permanent-lock behavior supported by the accepted canonical preparation data;
- final action is exactly `Launch` or `Launch & Buy`;
- Review remains under `/create/review`; do not create a standalone `/review` route;
- Task-5 double-submit protection, wallet/network handling, persistence and recovery must be reused.

## Durable-closeout rule

Until this handoff PR and `docs/current-build-state.yaml` are exact-head green and merged, Task 5 is `IMPLEMENTATION_MERGED_PENDING_DURABLE_HANDOFF`, not `INTEGRATED_PASS_DURABLE`.
