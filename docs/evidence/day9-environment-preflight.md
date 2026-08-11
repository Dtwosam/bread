# Day 9 — Arc Environment Preflight Evidence

Date: 2026-08-10

## Verdict

`DAY9_ARC_TESTNET_ENVIRONMENT_RECONCILIATION_PASS_WITH_DEPLOYMENT_BLOCKERS`

> **2026-08-11 supersession note:** The original Lane-1 evidence below is retained as historical evidence of the state observed on 2026-08-10. Its statements that the Arc Testnet DEX was unresolved were superseded on 2026-08-11 by `docs/evidence/day9-synthra-arc-testnet-v3-candidate.md` after the current Synthra SDK registry identified its Arc V3 Factory / Nonfungible Position Manager and an independent operator-executed read-only Arc RPC check proved runtime code, Factory identity, canonical 6-decimal USDC, and supported fee tiers. The canonical Arc Testnet network manifest may therefore select the verified `UNISWAP_V3` dependency family for testnet. This does not establish a deployed Bread stack, Day-9 PASS, an RC, production economics, or any Arc mainnet DEX selection. Full Bread graduation/fork integration remains mandatory.

This evidence establishes current Arc Testnet network identity/read-surface compatibility only. It does **not** by itself establish a Bread production deployment, Bread production economics, or Arc mainnet readiness.

## Baseline and change

- Durable Day-8 baseline: `fe9b13f1ce271fd5423fdd76de13034dac18fee1`
- Day-9 execution PR: #88
- RED test commit: `c0dd6e78a7eb33c1936716403466bacaa6adb408`
- Lane workflow commit: `5b3bafa752810895ac3ace7bdaabe1a8d9576f5c`
- Minimum GREEN manifest commit: `019d31c9d562d6cfdfec013a6662bdafe937659a`
- Day-9 Lane-1 workflow run: `31433486262` — PASS

The production manifest change at the time of this original evidence was limited to the Arc Testnet public RPC and WebSocket hosts:

```text
https://rpc.testnet.arc.io       -> https://rpc.testnet.arc.network
wss://rpc.testnet.arc.io         -> wss://rpc.testnet.arc.network
```

No chain ID, USDC address/decimals, Permit2, Create2 factory, Multicall3, explorer, DEX field, deployment address, economics value, admin value or mainnet value changed in that original Lane-1 change.

## Official-source reconciliation

Current official Arc documentation checked on 2026-08-10 publishes:

- Arc Testnet chain ID: `5042002`
- HTTP RPC: `https://rpc.testnet.arc.network`
- WebSocket RPC: `wss://rpc.testnet.arc.network`
- canonical Arc Testnet ERC-20 USDC: `0x3600000000000000000000000000000000000000`
- USDC decimals: `6`

Official Arc source surfaces used:

```text
https://docs.arc.network/arc/references/rpc
https://docs.arc.network/arc/references/contract-addresses
```

Arc mainnet remains treated as not yet source-resolved by Bread. The canonical Bread mainnet manifest remains intentionally empty/`AWAITING_OFFICIAL_VALUES`.

At the time of the 2026-08-10 Lane-1 check, the official Uniswap deployment registry did not authorize an Arc V3/V4 adapter in Bread and Bread therefore kept the Arc Testnet DEX configuration unresolved. The 2026-08-11 Synthra V3-compatible dependency evidence supersedes that testnet-only DEX disposition without changing the Arc mainnet disposition.

## TDD evidence

The dedicated regression initially failed only on the stale HTTP endpoint:

```text
expected: https://rpc.testnet.arc.network
received: https://rpc.testnet.arc.io
```

After the minimum two-endpoint correction, run `31433486262` passed:

1. `tests/day9/arc-testnet-environment-reconciliation.test.ts`
2. pinned Foundry 1.5.0 setup
3. read-only live Arc Testnet probe

The live probe established:

```text
cast chain-id -> 5042002
eth_getCode(canonical Testnet USDC) -> non-empty code
USDC.decimals() -> 6
```

No transaction was signed or broadcast.

## Typed disposition at original Lane-1 close

```text
ARC_TESTNET_NETWORK_IDENTITY = VERIFIED_CURRENT_OFFICIAL_READ_SURFACE
ARC_TESTNET_DEX = UNRESOLVED_DO_NOT_ACTIVATE   # superseded 2026-08-11 for testnet only
ARC_MAINNET_VALUES = OPEN_OFFICIAL_PUBLICATION_BLOCKER
CURRENT_PONS_FACTORY_SOURCE_PARITY = OPEN_NON_BLOCKING_FOR_BREAD_REHEARSAL
PONS_V2_RUNTIME_REFERENCE = REFERENCE_ONLY_NUMERIC_STATE_NOT_INFERRED
BREAD_PRODUCTION_ECONOMICS_CONFIG = OPEN_PUBLIC_MAINNET_RELEASE_GATE
PONS_AUDIT_FINDINGS = CONTINUING_WATCH_NO_AUDIT_CLEAN_CLAIM
```

## Hard boundaries preserved

- The original 2026-08-10 Lane-1 state retained `dex.type = UNRESOLVED_TESTNET_ADAPTER`; the current branch supersedes that testnet-only dependency state with the separately verified `UNISWAP_V3` manifest entry documented in the 2026-08-11 evidence.
- `config/deployments/arc-testnet.day5.json` remains blocked and has no active/deployed Bread stack until the actual Bread testnet deployment is executed and verified.
- `config/networks/arc-mainnet.json` remains intentionally empty for unpublished values.
- No production economics/admin/treasury/Guardian/Safe value is inferred.
- No Pons current-live source/runtime parity claim is created.
- No public/mainnet readiness claim is created.

## Current continuation after supersession

Run the vendor-neutral Arc V3 fork integration proof against the verified testnet dependencies. Only if that proof passes may the lane proceed toward a real Bread Arc Testnet deployment/rehearsal. A fork PASS still does not satisfy multisig recovery, remaining physical-device rows, exact-head CI, Day-9 RC, or Day-10 gates.
