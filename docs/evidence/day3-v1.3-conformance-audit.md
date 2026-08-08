# Day 3 — Source Pack v1.3 Conformance Audit

Status: **RATIFIED CANDIDATE — FINAL EXACT-HEAD CI / MERGE GATE PENDING**  
Date: 2026-08-08  
Repository: `Dtwosam/bread`  
Candidate PR: #8  
Accepted production-code baseline: `5d13689f1ebc54f609c0fcf61ea43287b207e61a`  
Repository workflow/handoff main before Day-3 merge: `f1eb742a8c521e80b66b4fed28df718f2ebdd0d7`

## 1. Project Source ratification

The active chat verified that the final post-research replacement set was actually uploaded and read back before affected Day-3 production code was changed or merged:

1. `00-bread-master-source-of-truth-v1.3.docx`
2. `03-pons-v2-to-arc-fork-delta-v1.3.docx`
3. `05C-financial-invariants-security-verification-plan-v1.3.docx`
4. `06A-implementation-architecture-repository-structure-v1.3.docx`
5. `06C-exact-10-day-build-order-daily-gates-v1.3.docx`
6. `06D-chatgpt-agent-execution-protocol-quality-gates-v1.3.docx`
7. `06E-continuous-system-integration-build-continuity-doctrine-v1.3.docx`
8. `06F-nested-lane-checkpoint-continuity-integration-gates-v1.3.docx`
9. `06H-cross-chat-continuity-build-state-handoff-protocol-v1.3.docx`
10. `bread-10-day-implementation-plan-v1.3.md`
11. `CURRENT-BUILD-STATE-v1.4.docx`

Those Project Sources were reconciled against:

- `main` recovery commit `f1eb742a8c521e80b66b4fed28df718f2ebdd0d7`;
- PR #8 candidate history;
- PR #9 stale closeout candidate;
- `docs/source-reconciliation/day3-external-component-research-matrix.md`;
- `docs/source-reconciliation/bread-source-pack-v1.3.md`.

Result:

```text
PROJECT_SOURCE_PACK = v1.3-post-research
PROJECT_SOURCE_UPLOAD = UPLOADED
PROJECT_SOURCE_RATIFICATION = RATIFIED
CANDIDATE_CODE_STATUS = RATIFIED_PENDING_FINAL_CI
```

One wording drift was explicitly resolved in favor of the final Project Sources: an older repo-side amendment described observed anti-snipe decay as exponential. The ratified Project Sources preserve only the approximately 99%-to-zero / approximately-five-second target envelope and keep `BREAD_SNIPE_DECAY_FORMULA` active. No exact anti-snipe formula is authorized by this Day-3 audit, and PR #8 contains no anti-snipe production implementation.

## 2. Audit method

The candidate was not trusted because it had previously compiled or passed tests. The audit re-read the ratified Project Sources and reviewed the actual PR #8 production/interface/test surfaces against them.

For a real divergence, the repair sequence was:

1. identify the source requirement and root cause;
2. add one production-facing failing test;
3. verify the failure is specific;
4. make the minimum production repair;
5. rerun the full repository gate;
6. add missing adversarial proof coverage without widening production semantics.

## 3. BreadFeeEscrow conformance

| Requirement | Result | Evidence / disposition |
| --- | --- | --- |
| Canonical USDC only | PASS | One immutable `usdc`; no multi-token ledger or caller-selected asset. |
| Bread-owned ledger | PASS | `balanceOf(recipient)` plus `totalOutstanding`; entitlement never derives from raw balance. |
| Exact authorized credit path | **REPAIRED / PASS** | Audit found owner could previously authorize an EOA. Ratified v1.3 forbids arbitrary EOA claim assignment. Added RED `testOwnerCannotAuthorizeEoaAsCreditor`; production now rejects enabling a creditor with `code.length == 0`. |
| Custody before credit | PASS | `transferFrom` occurs before ledger mutation; exact balance delta must equal requested amount. |
| Short-transfer / custody mismatch | PASS | Added real `ShortTransferUSDC6`; credit reverts and EVM rollback restores sender/custody/ledger/outstanding. |
| Solvency | PASS | Unit + fuzz/sequential evidence exercises `USDC.balanceOf(escrow) >= totalOutstanding`. |
| Full/partial own claims | PASS | Claims are fixed to `msg.sender`; no alternate-recipient claim surface. |
| Claim replay prevention | PASS | Added explicit successful-claim-then-replay test; second claim reverts with no additional payout. |
| State before external transfer | PASS | Added transfer observer; during claim transfer recipient ledger and outstanding are already debited. |
| Reentrancy safety | PASS | Claim functions are `nonReentrant`; transfer adversary attempts reentry and observes it blocked. |
| Failed transfer rollback | PASS | Reverting token transfer preserves custody, claim ledger and outstanding through transaction rollback. |
| Donation separation | PASS | Direct token donation increases `surplus()` only; no recipient entitlement is created. |
| Admin/rescue boundary | PASS | No admin withdrawal/rescue can consume recipient claim backing. |
| Deterministic events | PASS | Creditor update, fee credit and fee claim events expose deterministic accounting state. |
| No duplicate accounting authority | PASS | Escrow is the only Day-3 claim ledger; no external splitter/warehouse subsystem was imported. |

### Event asset identity

Checkpoint 6B requires fee-credit/claim indexed information to resolve recipient, asset and amount. Day-3's ratified implementation design freezes the current single-USDC event signatures without a caller-supplied asset field. The asset identity is deterministic from the emitting escrow/protocol stack's canonical quote asset; adding a second event-level asset choice would not create additional authority. Future SDK/indexer work must consume that canonical stack/escrow asset identity rather than invent a second interpretation.

## 4. BreadFeePolicy conformance

| Requirement | Result | Evidence / disposition |
| --- | --- | --- |
| Bread-owned policy | PASS | No Flaunch/0xSplits/OZ PaymentSplitter/Doppler runtime subsystem. |
| Explicit values / no guessed live defaults | PASS | Constructor/tests inject values; contract contains no claimed live Pons percentage defaults. `LIVE_RUNTIME_CONFIG` remains active. |
| 20% combined safety ceiling | PASS — source-derived | Frozen Pons source defines `MAX_TOTAL_TRADE_FEE_BPS = 2_000`; this is a bound, not a claim of live configured percentage. |
| Existing launch snapshot immutability | PASS | Curve snapshots protocol recipient, trade fee, protocol share and creator-tax maximum at construction; later policy updates do not rewrite the curve. |
| Future-policy updates only | PASS | `setCurrentFeePolicy` affects subsequent snapshots. |
| Creator tax separation | PASS | Creator tax is stored/accrued separately from the base fee. |
| Protocol/base-fee split rounding | PASS | Protocol amount floors the configured base-fee share; creator receives exact base-fee remainder plus creator tax, so base-fee allocation sums exactly. |
| Governance | PASS for contract boundary | Ownable configuration is compatible with the 05B Protocol Admin target; production handoff must set/retain the required Safe ownership. No Guardian economics setter exists here. |
| Sweep operator | PASS | Rotatable live operational role can trigger distribution only; it cannot rewrite snapshot economics or redirect fixed recipients. |

## 5. BreadBondingCurve Buy/Sell conformance

| Requirement | Result | Evidence / disposition |
| --- | --- | --- |
| ERC20 USDC-only quote path | PASS | No native quote branch/payable path/zero-address native sentinel. |
| Tracked reserves authoritative | PASS | Inherits `BreadTrackedCurveState`; raw donations do not alter pricing/graduation state. |
| Frozen constant-product behavior | PASS | Uses Day-2 `BreadBondingCurveMath` and frozen Pons ERC20 behavior reference. |
| Buy fee/tax quote-leg accounting | PASS | Fee and creator tax calculated from actual quote spent. |
| Sell fee/tax quote-leg accounting | PASS | Fee/tax calculated from gross quote output; user receives net output. |
| User slippage | PASS | Ordinary Buy/Sell bounds plus source-derived clamped-buy price-bound behavior. |
| Final crossing clamp | PASS | Output clamps to `sellableTokens()` / reserved floor. |
| Final reprice/gross-up/refund | PASS | Token-side `getAmountIn`, ceiling gross-up, fee/tax recompute, exact unspent quote refund. |
| Graduation-ready closure | PASS | Buy and Sell are closed once `readyToGraduate()` is true; no Day-3 auto-graduation. |
| Donation resistance | PASS | Concrete quote/token donation tests leave tracked reserves unchanged. |
| Tiny/repeated extraction | PASS | Day-2 tiny-trade invariants plus Day-3 Buy->Sell fuzz show no quote extraction. |
| Exact fee handoff | PASS | Explicit no-buyback sweep moves pending base fee/tax into canonical FeeEscrow credits. |
| Sweep rollback | PASS | Pending buckets/tracked quote update before external escrow calls; a downstream revert rolls the whole transaction back. |
| Creator recipient continuity | PASS | Factory-only future recipient rotation affects future sweeps and cannot rewrite already-credited escrow claims. |
| No unaccounted trade input | PASS | Exact ERC20 receipt checks plus final-buy refund; unsolicited donations are intentionally outside tracked pricing/accounting state. |

## 6. Integration continuity / future consumers

Day 3 freezes the real interfaces and semantics that later lanes must consume:

- `IBreadFeePolicy` and `BreadFeePolicySnapshot`;
- `IBreadFeeEscrow` claim/credit surface and events;
- `BreadBondingCurve` Buy/Sell/sweep/creator-recipient semantics;
- deterministic fee, tax, refund and claim meanings;
- representative unit/fuzz/integration fixtures.

The SDK/indexer/API/UI lanes do not yet exist at the level needed to wire these consumers. Under 06E/06F, the later lane must consume this handoff and may not create duplicate fee/accounting meanings.

## 7. Invariant coverage mapping

### INV-001 through INV-006

- **INV-001:** sequential trading/sweep/claim accounting reconciles recognized USDC flows; trade input, output, fee/tax and refund are explicit.
- **INV-002:** direct quote/token donation does not change tracked reserve state.
- **INV-003:** Buy/Sell/final-fill tests and sequential fuzz reconcile curve effect + fee/tax + refund/output under coded rounding.
- **INV-004:** over-claim and replay attempts fail; recipient cannot consume more than credited.
- **INV-005:** escrow solvency fuzz/sequential tests maintain custody >= totalOutstanding.
- **INV-006:** failed claim transfer reverts and preserves the claim.

### INV-020 through INV-026

- **INV-020:** Buy slippage rollback covered.
- **INV-021:** Sell slippage rollback covered.
- **INV-022:** final oversized buy clamps and refunds exact excess; dedicated fuzz invariant covers variable oversize.
- **INV-023:** Day-2 tracked-state graduation condition remains in the full regression suite.
- **INV-024:** ready-to-graduate Buy/Sell closure covered.
- **INV-025:** tiny/repeated no-extraction regression + Buy->Sell fuzz covered.
- **INV-026:** direct quote/token donation resistance covered.

### INV-030 through INV-035

- **INV-030:** creator tax is fixed per curve launch snapshot and bounded by the snapshot/source safety ceiling.
- **INV-031:** creator tax remains separate from base fee.
- **INV-032:** base-fee protocol allocation + creator remainder equals exact charged base fee; sequential sweep/claim fuzz exercises rounding.
- **INV-033 to INV-035:** **NOT APPLICABLE TO CURRENT DAY-3 CANDIDATE** because buyback/vesting implementation is explicitly excluded until its separate semantics/source gate is reconciled. No PASS is claimed for unimplemented buyback behavior.

## 8. TDD repair evidence

### EOA creditor divergence

RED head included `testOwnerCannotAuthorizeEoaAsCreditor` with production unchanged.

CI run `31265939060`:

- Foundry compile: PASS;
- 95 tests total;
- 94 PASS;
- exactly 1 FAIL: `testOwnerCannotAuthorizeEoaAsCreditor`.

Minimum production repair: enabling an authorized creditor now requires deployed contract code. Existing ledger, claim, fee and trading semantics were unchanged.

GREEN CI run `31266017924`:

- bootstrap-validation: PASS;
- dependency-build: PASS;
- foundry-bootstrap: PASS;
- infrastructure-health: PASS.

### Missing adversarial proof coverage

Added test-only fixtures/cases for:

- short-transfer custody mismatch;
- successful claim replay rejection;
- claim state-before-transfer observation;
- reentry attempt during claim transfer.

CI run `31266099983`:

- bootstrap-validation: PASS;
- dependency-build: PASS;
- foundry-bootstrap: PASS;
- infrastructure-health: PASS;
- Foundry: **98 passed / 0 failed / 0 skipped**.

The production implementation did not require further changes for these proof cases.

## 9. Source/dependency/security scope review

- Day-3 source inventory pins the frozen Pons trading source and Clanker FeeLocker adaptation reference by exact commit/path/blob/license.
- Added OpenZeppelin files are vendored from the frozen Pons tree and checked by executable blob-integrity validation.
- Dynamic dependency installation is disabled for the Day-3 Solidity dependency surface.
- No foreign splitter, warehouse, treasury manager, router, Permit2, WETH/native-quote, V4 PoolKey, NFT or foreign fee-recipient subsystem was introduced.
- No buyback/vesting, graduation transfer, Launch+Buy, anti-snipe, EmergencyController, Arc-mainnet constants or claimed current-live Pons factory parity is introduced by PR #8.
- Manual review of external calls covers ERC20 receipt/payout/refund, FeeEscrow credit handoff, claim transfer ordering, authorization, rounding and EVM rollback semantics.
- No unresolved critical/high defect was identified in the audited Day-3 scope. This is not an independent mainnet security audit; the Source Pack's later independent-review/release gates remain active.

## 10. Remaining non-Day-3 gates

These are **not silently cleared**:

- `CURRENT_PONS_FACTORY_SOURCE_PARITY`
- `LIVE_RUNTIME_CONFIG`
- `PONS_AUDIT_FINDINGS`
- `ARC_MAINNET_VALUES`
- `BREAD_SNIPE_DECAY_FORMULA` (Day 4 prerequisite before anti-snipe production code)

Resolved/superseded after ratification:

- `FEE_ESCROW_SOURCE` -> `RESOLVED_BY_APPROVED_BREAD_ADAPTATION_ARCHITECTURE`
- `LAUNCH_AND_BUY_SOURCE` -> `RESOLVED_BY_APPROVED_BREAD_OWNED_ARCHITECTURE`
- `EXACT_SNIPE_IMPLEMENTATION` -> `SUPERSEDED_BY_APPROVED_BREAD_OWNED_ARCHITECTURE`

## 11. Candidate verdict before final exact-head gate

**DAY_3_V1_3_SOURCE_TO_CODE_CONFORMANCE_AUDIT_PASS_PENDING_FINAL_EXACT_HEAD_CI**

No merge is authorized by this document alone. The exact PR #8 head containing this audit + synchronized build-state handoff must complete the full four-job repository CI gate successfully, then pass final diff/scope review and an expected-head guarded merge. After merge, `main` must be verified and Day 3 must be closed from a fresh closeout branch/state before Day 4 begins.
