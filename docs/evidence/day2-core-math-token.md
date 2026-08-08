# Day 2 — Core Math & Token Evidence

Status: IMPLEMENTED + REVIEW-HARDENED — PENDING FINAL EXACT-HEAD CI / MERGE

## Approved bounded scope

- `BreadBondingCurveMath` from frozen Pons V2 source blob `73929a6f64fc4a3e684ffff895a6ef0a018c2019`
- `BreadLaunchToken` from frozen Pons V2 source blob `3a362035edbcc8be7aeb54f1beb41fa1e01c230a`
- Frozen reference commit: `d5491e20be56051a68abf47136f6890c3ce3ff7d`
- Parity claim is limited to frozen-source behavior and does **not** claim current-live Pons deployment parity.

## Math TDD

The test-only `FrozenPonsBondingCurveMathReference` independently encodes the frozen arithmetic and does not import Bread production code.

### RED

- PR branch: `checkpoint/day2-core-math-token`
- RED head: `8028213a6bccec4c0c054677e186a3108f92f74e`
- CI run: `31254865534`
- `bootstrap-validation`: PASS
- `dependency-build`: PASS
- `infrastructure-health`: PASS
- `foundry-bootstrap`: EXPECTED FAIL
- Exact failure: `contracts/src/libraries/BreadBondingCurveMath.sol` absent.

### GREEN

- Production math commit/head: `f511a7d5d55fec64bf21580d17b4716403557e36`
- CI run: `31254898416`
- Source-faithful formulas, error conditions and `getAmountIn` `+1` round-up rule implemented.
- Deterministic differential tests: PASS.
- Bounded fuzz/property tests: PASS.
- Existing repository CI gates remained healthy.

## Frozen OpenZeppelin dependency provenance

Bread does not dynamically install a floating OpenZeppelin package for the launch token. The exact six files required by the frozen token import graph were copied from the same frozen Pons commit and verified using Git blob SHA before commit.

| Frozen upstream path | Exact Git blob SHA |
| --- | --- |
| `contractsV2/lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol` | `4d9d6b6d1c1f33e7cc3013d70e6c5af900bcbe9a` |
| `contractsV2/lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol` | `b493743a10c4fba04d91014cbdb7f69b639480c1` |
| `contractsV2/lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol` | `87bbafa84b834af1da027455bdc2e8a87beeb438` |
| `contractsV2/lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Burnable.sol` | `4d482d8ec83617f74febf13917b283c14ebb7760` |
| `contractsV2/lib/openzeppelin-contracts/contracts/utils/Context.sol` | `4e535fe03c243f864568b8f4430c17c25dbadb47` |
| `contractsV2/lib/openzeppelin-contracts/contracts/interfaces/draft-IERC6093.sol` | `e9d6249ef521e073253a8681aa8f022af7640850` |

The frozen file headers contain different "last updated" version markers (`v5.0.0`, `v5.0.1`, `v5.4.0`, `v5.5.0`). Bread therefore makes **no package-level OpenZeppelin version claim**; the exact blob map above is controlling.

A one-time branch-scoped vendor workflow was used only to fetch and verify these files because manually retyping security-sensitive upstream code would be less reliable. It committed the verified files and was immediately deleted. Normal Bread CI remains read-only and does not fetch OpenZeppelin dynamically.

- Verified vendor branch head observed: `4071c4ecacff3b645e118ea56fc1c479728f5ccb`
- Temporary workflow deletion commit: `c9e684f207f0382c733b47051f2ec303c68e6e2b`

## Token TDD

### RED

- RED head: `53e143d47ede2358c779176509f4b6e27f1a81d6`
- CI run: `31255073347`
- OpenZeppelin remapping/dependency resolution succeeded.
- `foundry-bootstrap`: EXPECTED FAIL
- Exact failure: `contracts/src/BreadLaunchToken.sol` absent.

### GREEN

- Production token commit/head: `69b85dbcf795af1f98e3e1d323c5a10ce4a98329`
- CI run: `31255097370`
- `bootstrap-validation`: PASS
- `dependency-build`: PASS, including frozen lockfile and clean tracked-worktree gate
- `foundry-bootstrap`: PASS
- `infrastructure-health`: PASS
- Foundry at this stage: 27 tests passed, 0 failed, 0 skipped.
  - Math suite: 14 PASS, including 5 fuzz tests at 256 runs each.
  - Token suite: 12 PASS, including supply fuzz at 256 runs.
  - Bootstrap compile: 1 PASS.

The token preserves the frozen source behavior: complete declared supply minted once to `curve`, immutable `deployer` / `launchFactory` / `curve`, metadata/social getters, standard ERC-20 transfer/allowance behavior, and holder `burn` / `burnFrom`. There is no owner/admin role, external/public mint, pause, blacklist or transfer tax.

## Integrated review and hardening

Review scope covered production token/math, deterministic/fuzz tests, Foundry remapping, source inventory and all six vendored OpenZeppelin files.

### Finding 1 — dependency provenance wording was too broad

The first inventory called the frozen dependency "OpenZeppelin 5.5.0" based on the `ERC20.sol` header. Other frozen required files carry older last-updated markers and no package-version file was verified at the vendored Pons path. Fixed by setting `packageVersionClaim: null`, recording each observed file marker separately, and treating exact Git blob SHAs as authority.

### Finding 2 — zero-supply frozen behavior was not explicitly covered

The frozen Pons token constructor permits `supply_ == 0`. Added `testAllowsZeroSupplyAndMintsNothing()` so Bread does not silently introduce a minimum-supply divergence later.

### Finding 3 — recorded dependency blobs were not enforced automatically

The exact blob map was initially evidence only. Added `scripts/validation/validate-day2-source-integrity.mjs`, wired it into `validate-all.mjs`, and added a bootstrap regression requiring the integrity gate.

Hardening RED:
- head: `7e217592e46c6fb2cc6559b63718e0b82d3e9fe3`
- CI run: `31255285593`
- bootstrap regression failed exactly because the new integrity validator was not yet wired.
- Foundry remained PASS.

Hardening GREEN:
- head: `9c57a8e2239af5c165de22023268632a35d991cd`
- CI run: `31255322107`
- all four CI jobs: PASS
- validator recomputes Git blob SHA-1 using the canonical `blob <length>\0<bytes>` format and fails if any vendored file drifts.

### Non-finding — immutable naming lint notes

Foundry notes that immutable variables conventionally use screaming-snake-case. Bread retains observable names `deployer`, `launchFactory`, and `curve` because those names are part of the approved frozen-source-faithful public ABI. This is a lint style note, not a correctness/security failure.

## Review verdict

No unresolved privilege, post-construction mint, formula, reserve-custody, snipe, Launch+Buy, FeeEscrow, graduation, hook, pool/router or Arc-mainnet leakage was found in the Day-2 production scope.

Final exact-head CI run/head: PENDING after this evidence + handoff update.
Merge: PENDING.

## Retained blockers

- `CURRENT_PONS_FACTORY_SOURCE_PARITY`
- `EXACT_SNIPE_IMPLEMENTATION`
- `LAUNCH_AND_BUY_SOURCE`
- `FEE_ESCROW_SOURCE`
- `LIVE_RUNTIME_CONFIG`
- `PONS_AUDIT_FINDINGS`
- `ARC_MAINNET_VALUES`

No blocked behavior is authorized or cleared by this lane.
