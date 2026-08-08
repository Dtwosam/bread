# Day 2 — Core Math & Token Evidence

Status: INTEGRATED LANE PASS — DAY 2 CONTINUES

## Approved bounded scope

- `BreadBondingCurveMath` from frozen Pons V2 source blob `73929a6f64fc4a3e684ffff895a6ef0a018c2019`
- `BreadLaunchToken` from frozen Pons V2 source blob `3a362035edbcc8be7aeb54f1beb41fa1e01c230a`
- Frozen reference commit: `d5491e20be56051a68abf47136f6890c3ce3ff7d`
- Parity claim is limited to frozen-source behavior and does **not** claim current-live Pons deployment parity.

## Math TDD

The test-only `FrozenPonsBondingCurveMathReference` independently encodes the frozen arithmetic and does not import Bread production code.

### RED
- Head: `8028213a6bccec4c0c054677e186a3108f92f74e`
- CI run: `31254865534`
- Three unrelated jobs PASS; Foundry failed specifically because `BreadBondingCurveMath.sol` did not exist.

### GREEN
- Production math head: `f511a7d5d55fec64bf21580d17b4716403557e36`
- CI run: `31254898416`
- Frozen formulas, errors, branch ordering and exact-output `+1` rounding preserved.
- Deterministic differential + bounded fuzz/property tests PASS.

## Frozen OpenZeppelin dependency provenance

The exact six files required by the frozen token import graph were copied from the same frozen Pons commit and verified by Git blob SHA before commit. Bread does not dynamically install a floating OpenZeppelin package for this token.

| Frozen upstream path | Exact Git blob SHA |
| --- | --- |
| `contractsV2/lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol` | `4d9d6b6d1c1f33e7cc3013d70e6c5af900bcbe9a` |
| `contractsV2/lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol` | `b493743a10c4fba04d91014cbdb7f69b639480c1` |
| `contractsV2/lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol` | `87bbafa84b834af1da027455bdc2e8a87beeb438` |
| `contractsV2/lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Burnable.sol` | `4d482d8ec83617f74febf13917b283c14ebb7760` |
| `contractsV2/lib/openzeppelin-contracts/contracts/utils/Context.sol` | `4e535fe03c243f864568b8f4430c17c25dbadb47` |
| `contractsV2/lib/openzeppelin-contracts/contracts/interfaces/draft-IERC6093.sol` | `e9d6249ef521e073253a8681aa8f022af7640850` |

The frozen file headers contain different last-updated markers, so Bread makes **no package-level OpenZeppelin version claim**. The exact blob map is controlling.

- Verified vendor branch head observed: `4071c4ecacff3b645e118ea56fc1c479728f5ccb`
- Temporary write-enabled vendor workflow removed at commit: `c9e684f207f0382c733b47051f2ec303c68e6e2b`
- Normal CI remains read-only.

## Token TDD

### RED
- Head: `53e143d47ede2358c779176509f4b6e27f1a81d6`
- CI run: `31255073347`
- OpenZeppelin remapping resolved correctly; Foundry failed specifically because `BreadLaunchToken.sol` did not exist.

### GREEN
- Production token head: `69b85dbcf795af1f98e3e1d323c5a10ce4a98329`
- CI run: `31255097370`
- All four jobs PASS.
- At that stage: 27 Foundry tests PASS, 0 fail, including 14 math tests and 12 token tests.

The token preserves complete declared-supply mint to `curve`, immutable attribution/factory/curve metadata, metadata/social getters, standard ERC-20 transfer/allowance behavior, and holder burn support. There is no owner/admin role, post-construction mint, pause, blacklist or transfer tax.

## Integrated review and hardening

Three issues were found and fixed before integration:

1. **Dependency provenance wording too broad.** Replaced an inferred package version with `packageVersionClaim: null`, per-file markers, and exact blob authority.
2. **Zero-supply parity not explicit.** Added `testAllowsZeroSupplyAndMintsNothing()` because the frozen source permits `supply_ == 0`.
3. **Blob inventory not executable.** Added `validate-day2-source-integrity.mjs`, wired it into bootstrap validation, and made CI recompute every vendored Git blob SHA.

Integrity hardening RED:
- head `7e217592e46c6fb2cc6559b63718e0b82d3e9fe3`
- run `31255285593`
- expected bootstrap failure because integrity validation was not yet wired.

Integrity hardening GREEN:
- head `9c57a8e2239af5c165de22023268632a35d991cd`
- run `31255322107`
- all four jobs PASS.

Foundry's non-failing naming notes for immutable `deployer`, `launchFactory`, and `curve` were deliberately not applied because those public names are part of the approved source-faithful ABI.

## Final exact-head integration proof

- Final PR #4 head: `d65a45c9da6c23f40a0a1861c75acf96bc8f8b33`
- Final CI run: `31255399674`
- `bootstrap-validation`: PASS
- frozen Day-2 dependency integrity: PASS
- `foundry-bootstrap`: PASS
- `dependency-build`: PASS
- frozen lockfile: PASS
- full TypeScript/build gate: PASS
- clean tracked-worktree gate: PASS
- `infrastructure-health`: PASS
- PR #4 merge commit: `0051d86f635ee4dfa9e2422f6f2fac7231e4f915`

## Lane verdict

`DAY_2_CORE_MATH_TOKEN_INTEGRATED_PASS`

This is **not** a Day-2 end-of-day PASS. Controlling 06C still requires the tracked-reserve curve skeleton plus donation-resistance/tiny-trade invariants and the remaining applicable Day-2 math/allocation/graduation coverage before the Day-2 gate can close.

## Retained blockers

- `CURRENT_PONS_FACTORY_SOURCE_PARITY`
- `EXACT_SNIPE_IMPLEMENTATION`
- `LAUNCH_AND_BUY_SOURCE`
- `FEE_ESCROW_SOURCE`
- `LIVE_RUNTIME_CONFIG`
- `PONS_AUDIT_FINDINGS`
- `ARC_MAINNET_VALUES`

No blocked behavior is authorized or cleared by this lane.
