# Day 3 v1.3 — Trading, Fees & Escrow Closeout

Status: **DURABLE PASS**  
Date: 2026-08-08  
Repository: `Dtwosam/bread`

## Final Day-3 verdict

`DAY_3_TRADING_FEES_ESCROW_INTEGRATED_PASS`

Project Source v1.3 was actually uploaded, read back and ratified before the pre-existing Day-3 candidate was allowed to merge. PR #8 was then audited requirement-by-requirement against the ratified sources, conforming work was preserved, one production divergence was repaired through RED -> GREEN TDD, missing adversarial proofs were added, and the candidate passed full exact-head CI before guarded merge.

## Ratified implementation baseline

Implementation PR #8:

- tested candidate head: `53c11f450677a204e541ba8468994586f01621b7`;
- exact-head CI: run `31266530130` — SUCCESS;
- Foundry: 98 passed / 0 failed / 0 skipped;
- all four repository jobs: PASS;
- guarded merge commit on `main`: `4f572bfd61cd57b33be994b895295be4522179b2`.

Durable source-to-code audit:

`docs/evidence/day3-v1.3-conformance-audit.md`

The audit found one production divergence: FeeEscrow previously permitted the owner to authorize an EOA creditor. Ratified v1.3 forbids arbitrary EOA claim-credit authority. A production-facing RED proved the divergence, and the minimum repair now requires deployed contract code when enabling a creditor.

Additional adversarial proof covers:

- short-transfer custody mismatch rollback;
- successful-claim replay rejection;
- claim state-before-transfer observation;
- claim reentry attempt blocked.

## Fresh closeout proof

The valid closeout was built only **after** the implementation merged and was created directly from `main` commit `4f572bfd61cd57b33be994b895295be4522179b2`.

Stale PR #9 was not reused.

The closeout added `contracts/test/Day3CloseoutPresence.t.sol`, which imports the actual merged Day-3 production/interfaces:

- `BreadBondingCurve`;
- `BreadFeeEscrow`;
- `BreadFeePolicy`;
- `IBreadFeeEscrow`;
- `IBreadFeePolicy`.

### Prerequisite closeout gate

- candidate head: `62fdceb627d10ce6055c1d913046e0cc4de7b897`;
- CI run: `31266693398` — SUCCESS;
- bootstrap-validation — PASS;
- dependency-build — PASS;
- foundry-bootstrap — PASS;
- infrastructure-health — PASS;
- Foundry — **99 passed / 0 failed / 0 skipped**.

Only after this run succeeded was the Day-3 PASS verdict stamped into evidence and the build-state handoff.

### Stamped exact-head gate

Stamped closeout head:

`fa92a4f244872a7f99b075cc2c639beb46a8831f`

Exact stamped-head CI:

- run `31266796631` — SUCCESS;
- bootstrap-validation — PASS;
- dependency-build — PASS;
- foundry-bootstrap — PASS;
- infrastructure-health — PASS.

The diff from the green prerequisite head to the stamped head contained only:

- `docs/evidence/day3-v1.3-closeout.md`;
- `docs/current-build-state.yaml`.

No production or test semantics changed after the 99-test prerequisite run.

PR #12 then merged the exact stamped head with expected-head protection.

Closeout merge commit on `main`:

`a67f42cae2b69c5c8ec4b07f0c2f2695ac4ea8a3`

Post-merge verification confirmed `main` contains this verdict and `Day3CloseoutPresenceTest` importing the real merged production surface.

## Integrated Day-3 capability

Day 3 durably includes:

- canonical 6-decimal ERC20-USDC Buy/Sell trading over tracked reserves;
- source-derived partial final-buy clamp, reprice, ceiling gross-up and exact refund;
- quote-leg base fee and separate creator tax accounting;
- Bread-owned FeePolicy with immutable existing-launch economic snapshots;
- Bread-owned canonical-USDC FeeEscrow;
- contract-only creditor authorization;
- custody-before-credit checks, recipient ledger and `totalOutstanding` solvency accounting;
- pull claims with state-before-transfer ordering, replay prevention and failed-transfer rollback;
- no-buyback fee sweep into exact protocol/creator escrow claims;
- creator recipient rotation affecting future sweeps only;
- donation resistance, slippage rollback, tiny/repeated no-extraction and sequential accounting proofs.

## Security / invariant disposition

Applicable Day-3 invariant coverage:

- INV-001 through INV-006 — PASS;
- INV-020 through INV-026 — PASS;
- INV-030 through INV-032 — PASS;
- INV-033 through INV-035 — not applicable to the current implementation because buyback/vesting remains separately gated and unimplemented.

No unresolved critical/high Day-3 defect was identified in the ratified audit scope. This does not waive later independent mainnet security-review requirements.

## Explicitly outside Day 3

Day 3 does not contain or authorize:

- buyback/vesting execution;
- automatic graduation or DEX transfer;
- Launch+Buy;
- anti-snipe production code;
- a frozen Bread snipe decay formula;
- native quote handling;
- guessed live Pons fee percentages;
- Arc mainnet constants;
- exact current-live Pons factory/source parity claims.

## Remaining gates

Still active:

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

## Durable closeout

`DAY_3_TRADING_FEES_ESCROW_INTEGRATED_PASS`

Day 3 is durably closed at the closeout baseline `a67f42cae2b69c5c8ec4b07f0c2f2695ac4ea8a3`. Day 4 has not begun as part of this closeout.
