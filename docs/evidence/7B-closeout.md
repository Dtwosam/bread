# Checkpoint 7B closeout evidence

Status: PRE-C0 candidate awaiting final exact-head CI.

## Repository
- Remote: `https://github.com/Dtwosam/bread`
- Branch: `checkpoint/7b-bootstrap`
- Draft PR: `#1`
- Base: `main`

## Preserved 7A gates
The repository still blocks:
- `CURRENT_PONS_FACTORY_SOURCE_PARITY`
- `EXACT_SNIPE_IMPLEMENTATION`
- `LAUNCH_AND_BUY_SOURCE`
- `FEE_ESCROW_SOURCE`
- `LIVE_RUNTIME_CONFIG`
- `PONS_AUDIT_FINDINGS`
- `ARC_MAINNET_VALUES`

No blocked financial implementation was added in 7B.

## Dependency / supply-chain evidence
- Node: `24.18.0`
- pnpm: `11.15.1`
- `pnpm-lock.yaml` committed by GitHub Actions after a successful full bootstrap build.
- Normal CI restored to `pnpm install --frozen-lockfile` with `contents: read`.
- pnpm build scripts explicitly allow only reviewed bootstrap builders `esbuild` and `sharp`.
- GitHub Actions references are pinned to exact SHAs.

## Web build evidence
- Next.js: `16.2.12`
- TypeScript: `7.0.2`
- TypeScript 7 CLI backend explicitly enabled in Next config.
- Next TypeScript configuration is committed rather than generated implicitly during CI.
- CI verifies the build leaves the tracked workspace clean.

## Solidity evidence
- Solidity: `0.8.26`
- Foundry: `v1.5.0`
- Foundry toolchain action pinned to `50d5a8956f2e319df19e6b57539d7e2acb9f8c1e`.
- Only a non-financial compiler/bootstrap test exists at this checkpoint.

## Infrastructure evidence
- PostgreSQL image pinned to `postgres:17.10-alpine`.
- Redis image pinned to `redis:8.8.1-alpine`.
- CI starts the exact Compose stack, waits for health, verifies `pg_isready`, verifies Redis `PONG`, and tears it down.

## Previous integrated green proof
CI run `31241518693` passed all four jobs on head `ded9495ad507ab85e31cfd40389a8fe9e3175ce7`:
- bootstrap-validation: PASS
- dependency-build: PASS
- foundry-bootstrap: PASS
- infrastructure-health: PASS

Review fixes were added after that run. Therefore this previous run is supporting evidence only, not the final 7B closeout proof.

## Final closeout gate
The final proof must be a fresh four-job CI run on the exact PR head containing this evidence file and all review fixes. PR #1 must remain unmerged until that run passes and no Critical/Important review finding remains.
