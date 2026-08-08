# Day 4 Project Source v1.4 Promotion / Ratification Record

Status: **PROJECT SOURCE v1.4 UPLOADED, READ BACK, RECONCILED AND RATIFIED FOR DAY-4 PRODUCTION**

Date: 2026-08-08

## Accepted baseline

- repository main before Day-4 production: `c6fcb53c854e45843b60720e3be859a49965bad2`
- accepted Day-3 closeout: `a67f42cae2b69c5c8ec4b07f0c2f2695ac4ea8a3`
- accepted Day-3 production integration: `4f572bfd61cd57b33be994b895295be4522179b2`
- approved/self-reviewed Day-4 design: `324b6055a0bed278766e1b48016774ac745b3781`

## Replacement Project Source set verified

The user uploaded/replaced the 12 controlling files and the active chat read them back:

1. `00-bread-master-source-of-truth-v1.4.docx`
2. `03-pons-v2-to-arc-fork-delta-v1.4.docx`
3. `05B-permissions-admin-control-key-management-v1.4.docx`
4. `05C-financial-invariants-security-verification-plan-v1.4.docx`
5. `06A-implementation-architecture-repository-structure-v1.4.docx`
6. `06C-exact-10-day-build-order-daily-gates-v1.4.docx`
7. `06D-chatgpt-agent-execution-protocol-quality-gates-v1.4.docx`
8. `06E-continuous-system-integration-build-continuity-doctrine-v1.4.docx`
9. `06F-nested-lane-checkpoint-continuity-integration-gates-v1.4.docx`
10. `06H-cross-chat-continuity-build-state-handoff-protocol-v1.4.docx`
11. `bread-10-day-implementation-plan-v1.4.md`
12. `CURRENT-BUILD-STATE-v1.5.docx`

The Project Sources intentionally carry forward older history. Their v1.4 Day-4 amendments explicitly supersede conflicting or unresolved earlier Day-4 text, while preserving accepted Day-1 through Day-3 behavior/evidence.

## Readback / reconciliation result

The uploaded replacements agree with repository main, the approved Day-4 design, and the living build-state on the affected architecture, economics and security decisions.

Verified Day-4 decisions:

- Bread-owned Factory/Deployer over the existing Day-3 curve/token/FeePolicy/FeeEscrow interfaces; no parallel fee, claim, creator-tax or trading ledger.
- No Day-4 CREATE2/deterministic-address promise and no claim of exact current-live Pons factory parity.
- Economics digest pins canonical USDC, supply, `phantomQuote`, `graduationThreshold`, FeePolicy snapshot values, `launchFeeUsdc`, stack/config identity and opening-protection policy identifiers.
- `launchFeeUsdc` is canonical 6-decimal ERC20 USDC; zero is allowed; no production value is guessed. A non-zero launch fee is 100% protocol revenue credited through canonical FeeEscrow to the snapshotted protocol recipient, with no Factory retention.
- Atomic Launch+Buy uses the canonical curve buy path, custodians exactly the launch-fee plus buy amount, and fully rolls back deployment/fees/custody on failure.
- Opening protection is buy-only with exact quadratic sequence `9900,6336,3564,1584,396,0` bps at elapsed seconds `0,1,2,3,4,>=5`.
- Only the one same-transaction Factory `launchTokenAndBuy` buy is exempt; there is no persistent exempt-wallet state.
- Opening-tax proceeds join the existing base-fee bucket and existing FeeEscrow path; creator tax remains separate.
- Final crossing fill uses the approved two-stage full-precision ceiling gross-up, recomputes exact floor charges from `spent`, requires `netCurveInput >= netRequired`, refunds `received - spent`, and reduces to the accepted Day-3 rule when snipe tax is zero.
- Emergency state is `NORMAL < NO_NEW_LAUNCHES < BUY_PAUSED < TRADING_PAUSED`, plus independent `graduationPaused`; Guardian only increases restrictions; Protocol Admin alone reduces/unpauses; Guardian has no custody/economic/configuration authority.
- INV-040 through INV-044 and INV-060 through INV-063 remain mandatory Day-4 proof gates.

No material source/design conflict was found during readback. Repository main remained exactly `c6fcb53c854e45843b60720e3be859a49965bad2` during the ratification check.

## Ratification state

```text
PROJECT_SOURCE_PACK = v1.4-day4-design
PROJECT_SOURCE_UPLOAD = UPLOADED
PROJECT_SOURCE_RATIFICATION_FOR_EXISTING_DAY1_DAY3_BASELINE = RATIFIED
DAY4_PROJECT_SOURCE_AMENDMENT = RATIFIED
PROJECT_SOURCE_RATIFICATION_FOR_DAY4_PRODUCTION = RATIFIED
DAY4_PRODUCTION_CODE = NOT_STARTED
```

The former `BREAD_SNIPE_DECAY_FORMULA` production blocker is resolved by the explicit Bread quadratic policy in this ratified pack. `CURRENT_PONS_FACTORY_SOURCE_PARITY` remains a truthfulness/parity-claim blocker, not a blocker to the approved Bread-owned Day-4 implementation. `LIVE_RUNTIME_CONFIG`, `PONS_AUDIT_FINDINGS` and `ARC_MAINNET_VALUES` remain active for their stated deployment/release scopes.

## Next gate

Ratification authorizes the **Day-4 implementation-planning step**. It does not by itself authorize unplanned production edits.

Next action: write and self-review the detailed Day-4 TDD implementation plan from this ratified Source Pack and the approved design. Only after that plan is committed may the first Day-4 production slice begin with RED tests.
