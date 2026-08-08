# Day 3 v1.3 — Trading, Fees & Escrow Closeout

Status: **DAY_3_TRADING_FEES_ESCROW_INTEGRATED_PASS — STAMPED CLOSEOUT HEAD REQUIRES FINAL EXACT-HEAD CI + GUARDED MERGE**  
Date: 2026-08-08  
Repository: `Dtwosam/bread`

## Final Day-3 verdict

`DAY_3_TRADING_FEES_ESCROW_INTEGRATED_PASS`

This verdict was stamped only after a fresh closeout branch, created from the actual merged Day-3 implementation baseline, passed the complete repository gate. The stamp becomes the durable `main` handoff only if the exact stamped head also passes the full gate and merges unchanged with expected-head protection.

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

## Fresh closeout proof

The closeout was created **after** PR #8 merged and branches directly from actual main commit `4f572bfd61cd57b33be994b895295be4522179b2`.

It does not reuse stale PR #9. PR #9 (`78796a0789ea70b076290494f3cb6c4c3bd2b9f4`) is historical/stale closeout evidence only and must not merge.

Fresh closeout candidate head before this PASS stamp:

`62fdceb627d10ce6055c1d913046e0cc4de7b897`

Fresh closeout prerequisite CI:

- run `31266693398` — SUCCESS;
- bootstrap-validation — PASS;
- dependency-build — PASS;
- foundry-bootstrap — PASS;
- infrastructure-health — PASS;
- Foundry — **99 passed / 0 failed / 0 skipped**.

The 99-test suite includes `contracts/test/Day3CloseoutPresence.t.sol`, which imports the actual merged Day-3 production/interfaces:

- `BreadBondingCurve`;
- `BreadFeeEscrow`;
- `BreadFeePolicy`;
- `IBreadFeeEscrow`;
- `IBreadFeePolicy`.

Therefore the closeout proof is anchored to the actual merged production surface, not stale prose.

## Ratified Day-3 capability closed by this verdict

The integrated implementation contains:

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

## Security / invariant disposition

The v1.3 source-to-code audit and final implementation suite establish the applicable Day-3 properties:

- INV-001 through INV-006 — covered;
- INV-020 through INV-026 — covered;
- INV-030 through INV-032 — covered;
- INV-033 through INV-035 — not claimed because buyback/vesting remains unimplemented and separately gated.

The audit found one production divergence: FeeEscrow previously permitted owner authorization of an EOA creditor. That divergence was repaired through a verified RED -> GREEN cycle. Enabling a creditor now requires deployed contract code. Additional adversarial proof covers short-transfer custody mismatch, successful-claim replay rejection, state-before-transfer observation and reentry blocking.

No unresolved critical/high Day-3 defect was identified in the ratified audit scope. This does not replace the later independent mainnet security-review requirement in the Source Pack.

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

The following remain active after Day 3:

- `BREAD_SNIPE_DECAY_FORMULA`;
- `CURRENT_PONS_FACTORY_SOURCE_PARITY`;
- `LIVE_RUNTIME_CONFIG`;
- `PONS_AUDIT_FINDINGS`;
- `ARC_MAINNET_VALUES`.

Resolved/superseded under ratified v1.3:

- `PROJECT_SOURCE_V1_3_RATIFICATION` -> `RATIFIED`;
- `FEE_ESCROW_SOURCE` -> `RESOLVED_BY_APPROVED_BREAD_ADAPTATION_ARCHITECTURE`;
- `LAUNCH_AND_BUY_SOURCE` -> `RESOLVED_BY_APPROVED_BREAD_OWNED_ARCHITECTURE`;
- `EXACT_SNIPE_IMPLEMENTATION` -> `SUPERSEDED_BY_APPROVED_BREAD_OWNED_ARCHITECTURE`.

## Final stamped-head gate

This PASS stamp must not merge on the strength of the earlier closeout run alone. After this file and `docs/current-build-state.yaml` are stamped:

1. run bootstrap/source-integrity validation;
2. run dependency install/validate/test/typecheck/build/workspace-clean verification;
3. run the complete Foundry unit/fuzz/invariant/integration suite including the closeout presence guard;
4. run PostgreSQL/Redis infrastructure health;
5. confirm all four jobs PASS on the exact stamped PR head;
6. merge only that exact head with expected-head protection;
7. verify `main` contains this verdict and the Day-3 production surface.

Only after steps 1-7 is this verdict a durable accepted project baseline. Day 4 must not begin before then.
