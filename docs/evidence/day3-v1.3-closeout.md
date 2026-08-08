# Day 3 v1.3 — Trading, Fees & Escrow Closeout

Status: **CLOSEOUT CANDIDATE — EXACT-HEAD CI REQUIRED BEFORE PASS**  
Date: 2026-08-08  
Repository: `Dtwosam/bread`

## Accepted implementation baseline

Day-3 implementation PR #8 was ratified, audited, exact-head verified and merged into `main` as:

`4f572bfd61cd57b33be994b895295be4522179b2`

PR #8 exact candidate head before merge:

`53c11f450677a204e541ba8468994586f01621b7`

Final implementation-candidate CI:

- run `31266530130` — SUCCESS;
- bootstrap-validation — PASS;
- dependency-build — PASS;
- foundry-bootstrap — PASS;
- infrastructure-health — PASS;
- Foundry — 98 passed / 0 failed / 0 skipped.

The implementation merge preserved Source Pack v1.3 ratification and the durable source-to-code audit at `docs/evidence/day3-v1.3-conformance-audit.md`.

## Fresh closeout construction

This closeout was created **after** PR #8 merged and branches directly from actual main commit `4f572bfd61cd57b33be994b895295be4522179b2`.

It does not reuse stale PR #9. PR #9 (`78796a0789ea70b076290494f3cb6c4c3bd2b9f4`) remains historical/stale closeout evidence only.

The closeout adds `contracts/test/Day3CloseoutPresence.t.sol`, which imports the actual merged Day-3 production/interfaces:

- `BreadBondingCurve`;
- `BreadFeeEscrow`;
- `BreadFeePolicy`;
- `IBreadFeeEscrow`;
- `IBreadFeePolicy`.

This ensures the closeout branch cannot pass by relying only on stale prose if the merged Day-3 production surface is absent.

## Ratified Day-3 capability being closed

The accepted implementation contains:

- canonical 6-decimal ERC20-USDC Buy/Sell trading over tracked reserves;
- source-derived partial final-buy clamp, reprice, ceiling gross-up and exact refund;
- quote-leg base fee and separate creator tax accounting;
- Bread-owned FeePolicy with immutable existing-curve economic snapshots;
- Bread-owned canonical-USDC FeeEscrow;
- contract-only creditor authorization for future claim credits;
- custody-before-credit checks, recipient ledger and `totalOutstanding` solvency accounting;
- pull claims with state-before-transfer ordering, replay prevention and failed-transfer rollback;
- no-buyback fee sweep into protocol/creator escrow claims;
- creator recipient rotation affecting future sweeps only;
- donation resistance, slippage rollback, tiny/repeated no-extraction and sequential accounting proofs.

## Explicit exclusions that remain exclusions

Day 3 does not contain or authorize:

- buyback/vesting execution;
- automatic graduation or DEX transfer;
- Launch+Buy;
- anti-snipe production code;
- a frozen Bread snipe decay formula;
- native quote handling;
- guessed live Pons fee percentages;
- Arc mainnet constants;
- a claim of exact current-live Pons factory/source parity.

## Remaining gates

The following remain active and are not cleared by Day-3 closeout:

- `BREAD_SNIPE_DECAY_FORMULA`;
- `CURRENT_PONS_FACTORY_SOURCE_PARITY`;
- `LIVE_RUNTIME_CONFIG`;
- `PONS_AUDIT_FINDINGS`;
- `ARC_MAINNET_VALUES`.

## Closeout gate

Before Day 3 can be stamped complete, the exact fresh closeout head must run the full repository CI gate:

1. bootstrap/source-integrity validation;
2. dependency install/validate/test/typecheck/build/workspace-clean check;
3. Foundry build and complete Solidity test/fuzz/invariant suite including the closeout presence guard;
4. PostgreSQL/Redis infrastructure health.

If that run passes, update this evidence and `docs/current-build-state.yaml` to the final Day-3 verdict, then rerun the full CI gate on that **new exact stamped head**. Only the exact stamped head may merge.

Candidate verdict:

`DAY_3_TRADING_FEES_ESCROW_CLOSEOUT_CANDIDATE_PENDING_EXACT_HEAD_CI`
