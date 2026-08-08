# Day 4 Project Source v1.4 Promotion Record

Status: **APPROVED DESIGN — PROJECT SOURCE UPLOAD / READBACK RATIFICATION PENDING**

Date: 2026-08-08

## Accepted baseline

- repository main before Day-4 production: `c6fcb53c854e45843b60720e3be859a49965bad2`
- accepted Day-3 closeout: `a67f42cae2b69c5c8ec4b07f0c2f2695ac4ea8a3`
- accepted Day-3 production integration: `4f572bfd61cd57b33be994b895295be4522179b2`
- approved/self-reviewed Day-4 design: `324b6055a0bed278766e1b48016774ac745b3781`

## Replacement Project Source set

The approved design is promoted through these 12 controlling replacement files:

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

## Frozen Day-4 decisions being promoted

- Bread-owned Factory/Deployer over existing Day-3 curve/token/FeePolicy/FeeEscrow interfaces.
- No Day-4 CREATE2/deterministic-address promise.
- Economics digest pins canonical USDC, supply, phantomQuote, graduationThreshold, FeePolicy snapshot, launchFeeUsdc, stack/config identity and opening-protection policy.
- launchFeeUsdc is canonical ERC20 USDC; zero allowed; non-zero amount is 100% protocol revenue credited through canonical FeeEscrow; no Factory retention.
- Atomic Launch+Buy uses the canonical curve buy path and fully rolls back deployment/fees/custody on failure.
- Opening protection is buy-only with exact quadratic sequence `9900,6336,3564,1584,396,0` bps over integer elapsed seconds `0,1,2,3,4,>=5`.
- Only the one same-transaction Factory Launch+Buy call is exempt; no persistent wallet exemption.
- Opening-tax proceeds join the existing base-fee bucket and existing FeeEscrow path; creator tax remains separate.
- Final crossing fill uses the approved two-stage full-precision ceiling gross-up and reduces to the accepted Day-3 rule when snipe tax is zero.
- Emergency state is `NORMAL < NO_NEW_LAUNCHES < BUY_PAUSED < TRADING_PAUSED`, plus independent `graduationPaused`; Guardian only increases restrictions; Protocol Admin alone reduces/unpauses; Guardian has no custody/economic authority.

## Ratification state

```text
PROJECT_SOURCE_PACK = v1.4-day4-design
PROJECT_SOURCE_RATIFICATION_FOR_EXISTING_DAY1_DAY3_BASELINE = RATIFIED
DAY4_PROJECT_SOURCE_AMENDMENT = APPROVED_PENDING_UPLOAD_READBACK
PROJECT_SOURCE_RATIFICATION_FOR_DAY4_PRODUCTION = NOT_RATIFIED
DAY4_PRODUCTION_CODE = NOT_STARTED
```

The generated files existing outside the Project Source store do **not** satisfy upload/ratification. The user must replace/upload them. The active chat must then read them back and reconcile them against this record, GitHub main, and `docs/current-build-state.yaml`.

Only after explicit `PROJECT_SOURCE_RATIFICATION_FOR_DAY4_PRODUCTION = RATIFIED` may the detailed implementation plan be written and then TDD production work begin.
