# Day 1 — Pons reference inventory and reconciliation reader

Status: IMPLEMENTED — PENDING INTEGRATED MERGE

## Frozen public reference

- Repository: `ponsdotdev/ponsfamily`
- Frozen commit: `d5491e20be56051a68abf47136f6890c3ce3ff7d`
- V2 source root: `contractsV2/src/v2`
- Frozen public README V2 factory recorded by the 7A source reconciliation: `0x7E1EAbd52Ae29598e6483F72dCf1a70b14284dB8`
- Current Pons V2 docs factory recorded by the 7A source reconciliation: `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e`
- Those factory addresses differ. Exact current-live source parity therefore remains unproven.

## Source and license inventory

The frozen repository did not expose a root `LICENSE` file at the recorded commit through the repository contents lookup. Bread therefore does not infer a repository-wide license from a missing root file.

The inspected Pons V2 project source files below each declare `SPDX-License-Identifier: MIT`:

| Source | Frozen blob SHA |
| --- | --- |
| `contractsV2/src/v2/PonsV2LaunchFactory.sol` | `2bc506657902f4b829e45e0a10f88e2fd76239e6` |
| `contractsV2/src/v2/interfaces/ILaunchpadV2.sol` | `5fac4a72f6be47e51971bc477f65f2447d1770f9` |
| `contractsV2/src/v2/hooks/PonsV2MemeHook.sol` | `e59e5a55550b512adddf9a0263210128edbc7abf` |

This is a file-level inventory only. It does not assert that every vendored dependency in the upstream repository is MIT-licensed.

## Read-only reconciliation reader

`packages/protocol-sdk/src/pons-live-reconcile.ts` now provides a read-only Pons V2 reconciliation surface. It can observe:

- current factory runtime bytecode length and keccak256
- `launchFee`
- `launchEnabled`
- `maxCreatorTaxBps`
- `launchConfigCount` and bounded `getLaunchConfig` enumeration
- `approvedPairTokens` and `pairTokenEconomics` for operator-supplied candidate pair tokens
- factory dependency getters for the hook, escrow, buyback vault, locker, graduation executor, launch deployer and graduation guard
- the hook's `currentFeePolicy`

The reader uses only public-client read operations. It contains no transaction submission or contract-write path. Unreadable fields are returned as explicit `UNREADABLE` observations instead of being guessed.

## TDD / CI evidence

RED:
- CI run `31249608035`
- build-state validation passed after removing the stale hard-coded 7B checkpoint assumption
- the new Pons reference test failed exactly because `currentDocsFactory` was absent

GREEN:
- implementation head: `fb526e15ad3e9432a4c5ec887a01dbb4d789b137`
- CI run: `31249698722`
- bootstrap validation: PASS
- Pons reference regression: PASS
- frozen dependency install: PASS
- tests: PASS
- TypeScript: PASS
- full workspace build: PASS
- clean tracked worktree after build: PASS
- Foundry bootstrap: PASS
- PostgreSQL/Redis health: PASS

## Blockers deliberately retained

This lane does not prove that the current documented Pons V2 deployment is bytecode-equivalent to the frozen public source, and it does not obtain the missing exact snipe, Launch+Buy or concrete FeeEscrow implementation.

The following remain active:
- `CURRENT_PONS_FACTORY_SOURCE_PARITY`
- `EXACT_SNIPE_IMPLEMENTATION`
- `LAUNCH_AND_BUY_SOURCE`
- `FEE_ESCROW_SOURCE`
- `LIVE_RUNTIME_CONFIG`
- `PONS_AUDIT_FINDINGS`
- `ARC_MAINNET_VALUES`

No Bread financial contract implementation was added in this lane.
