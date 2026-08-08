# Day 5 Preflight Blocker Burn-Down

Date: 2026-08-08
Status: EVIDENCE COMPLETE — PROJECT SOURCE AMENDMENT REQUIRED BEFORE DAY-5 PRODUCTION CODE

## Verified continuation baseline

- Day-4 verdict: `DAY_4_FACTORY_LAUNCH_BUY_SNIPE_EMERGENCY_INTEGRATED_PASS`
- Day-4 implementation PR: #15
- implementation head: `d08a33c00bb17eb96ef342ee25d48fb696f7ea4d`
- implementation CI: `31275557000` — all four repository jobs PASS
- implementation merge: `aec8eb1f90693d8883e4849503c8e50a0ed79b80`
- Day-4 closeout prerequisite head: `a9f0cf839cda7b67b5e38fe199367c3b7757d2ea`
- closeout prerequisite CI: `31276781025` — all four repository jobs PASS
- stamped closeout head: `8e0eaac8f1ce21f4654286a6e3f9113fd4de7a4b`
- stamped closeout CI: `31276843224` — all four repository jobs PASS
- Day-4 closeout PR: #23
- `DAY4_CLOSEOUT_MILESTONE = 7533b9f243e1c53106188aa662919f6166448f2e`
- post-closeout handoff CI: `31276981183` — all four repository jobs PASS
- handoff PR: #24
- `DAY5_CONTINUATION_BASELINE = bc2985c2c79d20aee6a9c2e5fb4c5f92e163e87c`

No Day-5 production Solidity was present or started at the verified baseline.

## Controlling Project Source direction

The uploaded v1.4 Project Sources require:

- Day N to start from the latest integrated green descendant of Day N-1;
- Day 5 to implement `GraduationCoordinator`, `IGraduationAdapter`, V4 where supported, a non-activated V3 fallback where needed, permanent locking, failure/retry/dust/wrong-dependency handling and deployment scripts;
- `INV-050` through `INV-056` plus no duplicate liquidity on retry;
- official Arc/DEX sources to control network/deployment facts;
- no fabricated live config, contract address, audit conclusion or parity claim;
- Project Source upload/readback ratification before production code affected by a changed controlling decision.

## Burn-down matrix

| Blocker | Original reason | Fresh evidence checked | Current Bread relevance | Can resolve now? | Recommended classification | Blocks Day 5? | Blocks testnet? | Blocks mainnet? | Blocks public release? | Source amendment required? | Replacement gate / resolution condition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CURRENT_PONS_FACTORY_SOURCE_PARITY` | Public Pons V2 source and current V2 docs named different Factory deployments and successor behavior was not represented completely in frozen public source. | Current public repo still has latest observed commit `d5491e20be56051a68abf47136f6890c3ce3ff7d`; README names V2 Factory `0x7E1EAbd52Ae29598e6483F72dCf1a70b14284dB8`. Current official `/v2` docs name Factory `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e` and describe successor Launch+Buy/snipe/runtime surfaces. | Bread Day 4 deliberately owns Factory/Deployer, Launch+Buy and opening-protection semantics and does not claim exact-current Pons parity. | No, exact current runtime/source equivalence is still not publicly proved by the evidence available here. | `OPEN_REFERENCE_GAP_NON_BLOCKING_FOR_BREAD; BLOCKS_ONLY_EXACT_CURRENT_PONS_PARITY_CLAIMS` | NO | NO | NO | NO, provided Bread makes no exact-current-Pons parity claim | NO for this classification; it restates the controlling v1.4 meaning. | Preserve frozen Pons source as provenance/reference. Clear only if exact deployed-source/runtime equivalence is independently proved. |
| `LIVE_RUNTIME_CONFIG` | Current Pons live launch configs, fee cap, launch fee, approved pairs/economics and fee policy were to be read rather than guessed. | Current official V2 docs verify current deployed addresses and the read surface: `launchConfigCount`, `getLaunchConfig`, `previewLaunchEconomics`, `launchFee`, `maxCreatorTaxBps`, `canLaunch`. Numeric current V2 runtime state could not be read from this execution environment because the Robinhood RPC hostname could not be resolved; no write was attempted. Day-4 sources already explicitly make Bread launch fee canonical-USDC and Bread-owned rather than native-Pons copied state. | Pons runtime remains useful comparison evidence, but it is no longer a single authoritative source for Bread production configuration. Bread needs explicit production USDC economics/admin/deployment values of its own. | PARTIAL. Interface/address/reference reconciliation is current; numeric Pons runtime snapshot remains unread here. | Split: `PONS_V2_RUNTIME_REFERENCE = READ_SURFACE_VERIFIED_NUMERIC_STATE_PENDING` and `BREAD_PRODUCTION_ECONOMICS_CONFIG = OPEN` | Pons reference: NO. Bread production config: NO for Day-5 implementation/design unless a test requires a production-only value; use explicit test-only values. | NO | YES | YES | **YES** — replacing one vague gate with a reference-only Pons read plus an explicit Bread-owned production configuration gate changes controlling gate semantics. | `BREAD_PRODUCTION_ECONOMICS_CONFIG`: freeze actual production `launchFeeUsdc`, final FeePolicy values, protocol/creator/admin/Guardian/Safe recipients as applicable, stack/config version and deployment manifest values before public/mainnet deployment. Never infer them from Pons. |
| `PONS_AUDIT_FINDINGS` | Pons V2 audits were in progress; accepted fixes could matter to Bread, especially graduation/fees. | Current official Pons V2 Audits section still states SB Security, Dingbats and Pashov Audit Group reviews are all in progress; no audit has closed; V2 should be treated as unaudited until reports publish. Bounded public search did not identify a published Pons V2 report. | No actual published finding exists to map today. Bread's independent unit/fuzz/invariant/static/manual/independent-review obligations remain mandatory regardless. | Yes, as a dated evidence status; not as an “audit clean” conclusion. | `NO_PUBLIC_PONS_AUDIT_REPORTS_PUBLISHED_AS_OF_2026-08-08; CONTINUING_SECURITY_WATCH; BREAD_INDEPENDENT_REVIEW_REQUIRED` | NO | NO | NO by itself | Watch must be rechecked before unrestricted public release; Bread independent review is still a release gate | NO; this is the exact monitoring behavior already required by v1.4. | Recheck before release and whenever Pons publishes reports; map every relevant accepted/rejected finding to analogous Bread code and required tests/mitigations. |
| `ARC_MAINNET_VALUES` | Mainnet chain/RPC/USDC/DEX/dependency values were not officially published and must not be guessed. | Current official Arc contract-address page says all listed addresses are Arc Testnet and mainnet addresses are not yet available. Current RPC page is testnet-only and says mainnet endpoints/parameters will be published separately when available. Arc docs still describe Arc as in testnet phase. Official Uniswap v4 deployment registry contains no Arc network entry. | External publication dependency only. Arc Testnet remains valid for Bread development using the validated testnet manifest. No canonical Arc Uniswap address may be activated from expectation. | No, publication has not happened. | `WAITING_FOR_OFFICIAL_PUBLICATION; MAINNET_DEPLOYMENT_BLOCKER_ONLY; NOT_DAY5_TESTNET_IMPLEMENTATION_BLOCKER` | NO, provided Day-5 network activation is not fabricated | NO | YES | Only if public release target is Arc mainnet; does not block testnet engineering/rehearsal | NO; this matches the controlling v1.4 rule. | Recheck official Arc contract/RPC docs and official DEX deployment registry. Freeze values only after official publication and compatibility tests. |

## Current Pons parity evidence

Public repository:

- repository: `ponsdotdev/ponsfamily`
- latest observed public commit: `d5491e20be56051a68abf47136f6890c3ce3ff7d`
- README V2 Factory: `0x7E1EAbd52Ae29598e6483F72dCf1a70b14284dB8`

Current official Pons V2 docs (`https://docs.ponsfamily.com/v2`):

- Factory: `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e`
- Fee escrow: `0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e`
- Launch and buy: `0xe33E9E479dF8802cb0866d5d05258bEc4cF62948`
- Launch deployer: `0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42`
- Graduation executor: `0xC7819B64A1dAECD7eC19856d026cb14EfBd89046`
- Graduation guard: `0xf5695117b99B6f6401e67d4195BD653628176C6C`

The public-repo/current-doc Factory mismatch remains. Exact current-live source/runtime parity is therefore not claimed.

## Current Pons audit evidence

Current official `/v2` docs state on 2026-08-08:

- SB Security review: in progress
- Dingbats review: in progress
- Pashov Audit Group review: in progress
- no audit has closed
- treat Pons V2 as unaudited until reports are published

Disposition: this is bounded negative evidence, not proof of security. If a report appears before Bread release, review it and map relevant findings to Bread. Bread's own independent review remains mandatory regardless.

## Arc / DEX evidence

Current official Arc docs (`https://docs.arc.io/arc/references/contract-addresses`) state:

- all published contract addresses are Arc Testnet only;
- mainnet addresses are not yet available;
- testnet ERC-20 USDC remains `0x3600000000000000000000000000000000000000`, 6 decimals.

Current official Arc RPC docs (`https://docs.arc.io/arc/references/rpc-endpoints`) state:

- Arc Testnet chain ID remains `5042002`;
- listed RPC/WS endpoints and parameters are testnet values;
- mainnet endpoints/parameters are published separately when available.

Current official Uniswap v4 deployment registry (`https://developers.uniswap.org/docs/protocols/v4/deployments`) has no Arc entry at this check.

Day-5 implication:

- keep `IGraduationAdapter` DEX-neutral;
- target official V4/V3 interfaces rather than guessed Arc addresses;
- test graduation using local/controlled official-interface fixtures until an authoritative Arc deployment is available;
- do not activate a canonical Arc V4/V3 adapter in a network manifest without official deployment evidence;
- preserve V3 as an unactivated fallback unless evidence requires it.

## Live runtime configuration disposition

The current V2 docs verify the runtime-read ABI/surface but do not publish the live numeric values for every config. A direct read-only RPC attempt from this execution environment failed at DNS resolution before any JSON-RPC state call could be made. No write or transaction was attempted.

The correct risk split is therefore:

1. `PONS_V2_RUNTIME_REFERENCE`
   - comparison/provenance evidence;
   - exact numeric snapshot still pending a successful read-only runtime read;
   - blocks only exact claims about current Pons runtime economics/config.

2. `BREAD_PRODUCTION_ECONOMICS_CONFIG`
   - Bread-owned release/deployment gate;
   - must freeze real production values before public/mainnet deployment;
   - must not be inferred automatically from current Pons values;
   - testnet/unit/integration work uses explicit test-only values and may continue when no production-only value is needed.

Because this split changes the controlling meaning of the legacy `LIVE_RUNTIME_CONFIG` gate and creates a replacement Bread-owned production gate, a Project Source amendment is required before affected Day-5 production implementation proceeds.

## Day-5 environment/preflight conclusion

The current evidence supports the Day-5 architecture direction already present in Project Sources:

`Factory / Curve -> graduation readiness -> GraduationCoordinator -> snapshotted IGraduationAdapter -> canonical DEX when verified -> permanent locker -> canonical events -> later SDK/indexer/API/UI consumers`

Day-4 `graduationPaused` remains a restriction oracle only. It must not become graduation accounting or custody state.

No Day-5 production Solidity is authorized by this evidence document.

## Required source-governance disposition

`PROJECT_SOURCE_AMENDMENT_REQUIRED = YES`

Reason: the legacy `LIVE_RUNTIME_CONFIG` gate must be split into a Pons reference/parity read and a Bread-owned production configuration approval gate. Research evidence alone does not change Project Sources.

Required sequence:

1. generate consolidated replacement Project Sources carrying this gate split and current Day-4 closed baseline;
2. user uploads/replaces those Project Sources;
3. active chat reads them back and reconciles them against GitHub plus `docs/current-build-state.yaml`;
4. explicitly set `PROJECT_SOURCE_RATIFICATION = RATIFIED` only if they agree;
5. only then proceed to consequential Day-5 architecture approval/design and production TDD.

## Preflight status

```text
DAY_5_PREFLIGHT_RECONCILIATION = EVIDENCE_COMPLETE_SOURCE_RATIFICATION_PENDING

CURRENT_PONS_FACTORY_SOURCE_PARITY =
OPEN_REFERENCE_GAP_NON_BLOCKING_FOR_BREAD;
BLOCKS_ONLY_EXACT_CURRENT_PONS_PARITY_CLAIMS

LIVE_RUNTIME_CONFIG =
SPLIT_REQUIRED:
PONS_V2_RUNTIME_REFERENCE = READ_SURFACE_VERIFIED_NUMERIC_STATE_PENDING;
BREAD_PRODUCTION_ECONOMICS_CONFIG = OPEN_PUBLIC_MAINNET_RELEASE_GATE

PONS_AUDIT_FINDINGS =
NO_PUBLIC_PONS_AUDIT_REPORTS_PUBLISHED_AS_OF_2026-08-08;
CONTINUING_SECURITY_WATCH;
BREAD_INDEPENDENT_REVIEW_REQUIRED

ARC_MAINNET_VALUES =
WAITING_FOR_OFFICIAL_PUBLICATION;
MAINNET_DEPLOYMENT_BLOCKER_ONLY;
NOT_DAY5_TESTNET_IMPLEMENTATION_BLOCKER

PROJECT_SOURCE_AMENDMENT_REQUIRED = YES
PROJECT_SOURCE_RATIFICATION = PENDING
DAY4_CLOSEOUT_MILESTONE = 7533b9f243e1c53106188aa662919f6166448f2e
DAY5_START_BASELINE = bc2985c2c79d20aee6a9c2e5fb4c5f92e163e87c
DAY5_PRODUCTION_CODE = NOT_STARTED
```

## Primary evidence references

- Bread Project Source Pack v1.4 uploaded files, especially Master Source of Truth, fork delta, permissions, financial invariants, 06C/06D/06E/06F/06H, 07A, implementation plan and CURRENT-BUILD-STATE.
- Pons current V2 docs: https://docs.ponsfamily.com/v2
- Pons public source: https://github.com/ponsdotdev/ponsfamily @ `d5491e20be56051a68abf47136f6890c3ce3ff7d`
- Arc contract addresses: https://docs.arc.io/arc/references/contract-addresses
- Arc RPC endpoints: https://docs.arc.io/arc/references/rpc-endpoints
- Uniswap v4 deployments: https://developers.uniswap.org/docs/protocols/v4/deployments
