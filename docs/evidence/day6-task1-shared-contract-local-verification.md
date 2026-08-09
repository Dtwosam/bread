# Day 6 Task 1 — Shared Protocol Contract Local Verification

Date: 2026-08-09
Branch: `agent/day6-task1-shared-protocol-contract`
Draft PR: `#37`
Starting HEAD: `4cf874ae05c564c07838e5ee26d2163153f77a51`
Accepted main baseline: `81db147ef7be8191981fb10afd425fa4f2f0e280`

## Scope and disposition

This record recovers the exact local Task-1 gates that GitHub Actions runs `31288355378` and `31288420878` did not execute. It does not claim guarded Task-1 acceptance, merge PR #37, or authorize Task 2. Fresh exact-head GitHub CI remains required.

The requested `AGENTS.md` was absent from the repository, its tracked file list, and the repository parent. The remaining required build-state, handoff, design, and plan files were read before verification.

## Repository and toolchain preflight

| Command | Exit | Result |
| --- | ---: | --- |
| `git status --short` | 0 | clean |
| `git remote get-url origin` | 0 | `https://github.com/Dtwosam/bread.git` |
| `git branch --show-current` | 0 | `agent/day6-task1-shared-protocol-contract` |
| `git rev-parse HEAD` | 0 | `4cf874ae05c564c07838e5ee26d2163153f77a51` |
| `git fetch origin main` | 0 | fetched `main` |
| `git rev-parse origin/main` | 0 | `81db147ef7be8191981fb10afd425fa4f2f0e280` |
| `git log --oneline 81db147ef7be8191981fb10afd425fa4f2f0e280..origin/main` | 0 | no intervening commits |
| `node --version` | 0 | `v24.18.0` |
| `pnpm --version` via the pinned Corepack shim | 0 | `11.15.1` |
| `forge --version` via official `@foundry-rs/forge@1.5.0` | 0 | `1.5.0-v1.5.0`, commit `1c57854462289b2e71ee7654cd6666217ed86ffd` |

The plain non-login PATH initially returned exit 127 for both `pnpm --version` and `forge --version`. Pnpm 11.15.1 was resolved through the repository-pinned Corepack package manager. Forge v1.5.0 was obtained from the official Foundry npm package into a temporary tool cache; no toolchain file was added to the repository.

## Required command ledger

All commands below used Node 24.18.0, pnpm 11.15.1, Foundry v1.5.0, and solc 0.8.26.

| Command | Exit | Exact result |
| --- | ---: | --- |
| `pnpm install --frozen-lockfile` | 0 | 224 packages installed; lockfile unchanged; supply-chain policy passed for 321 entries |
| `pnpm validate` | 0 | all nine validation lines PASS |
| `pnpm test` | 0 | 9 passed, 0 failed, 0 skipped |
| `pnpm exec vitest run tests/day6/shared-contract.test.ts` | 0 | 1 file passed; 4 passed, 0 failed |
| `pnpm typecheck` | 0 | `tsc -b` PASS |
| `pnpm build` | 0 | all 10 participating workspace projects built; Next.js emitted `/` and `/_not-found` |
| `cd contracts && forge build && cd ..` | 0 | 87 files compiled successfully with solc 0.8.26 |
| `pnpm abi:check` before generation | 1 | expected placeholder drift only: generated ABI registry stale |
| `pnpm abi:generate` | 0 | wrote `packages/protocol-sdk/src/abi/generated.ts` from exact artifacts |
| `pnpm abi:generate` determinism rerun | 0 | byte-identical output |
| `pnpm abi:check` after generation | 0 | `bread-abi-check: PASS` |
| `pnpm exec vitest run tests/day6/shared-contract.test.ts` after generation | 0 | 1 file passed; 4 passed, 0 failed |
| `pnpm typecheck` after generation | 0 | `tsc -b` PASS |
| `pnpm build` after generation | 0 | all participating workspaces built |
| `cd contracts && forge build && cd ..` after generation | 0 | no source changes; exact artifacts current |
| `cd contracts && forge test && cd ..` | 0 | 35 suites; 201 passed, 0 failed, 0 skipped |
| `docker compose -f infra/docker/compose.yaml up -d --wait --wait-timeout 60` | 0 | PostgreSQL 17.10 and Redis 8.8.1 containers healthy |
| `docker compose -f infra/docker/compose.yaml exec -T postgres pg_isready -U bread -d bread` | 0 | `/var/run/postgresql:5432 - accepting connections` |
| `docker compose -f infra/docker/compose.yaml exec -T redis redis-cli ping` | 0 | `PONG` |
| `docker compose -f infra/docker/compose.yaml down -v` | 0 | containers, network, and temporary Postgres volume removed |

The first sandboxed `pnpm install --frozen-lockfile` attempt encountered registry DNS denial and was terminated before retrying the unchanged command with network permission. The first sandboxed `forge build` returned exit 1 with `Operation not permitted`; the same exact build passed once Foundry could access its temporary compiler cache. The first compose attempt returned exit 1 because Docker Desktop was stopped; after starting the local daemon, the unchanged compose command and both health probes passed.

## Generated ABI inspection

Only `packages/protocol-sdk/src/abi/generated.ts` changed during implementation verification. The unchanged generator:

- reads eight explicit `contracts/out/**` Foundry artifacts;
- retains every artifact event/error and only explicitly allowlisted functions;
- sorts ABI items by deterministic signature key;
- serializes the registry with stable JSON formatting;
- writes no other file.

Generated registry counts:

| Role | Errors | Events | Functions | Total |
| --- | ---: | ---: | ---: | ---: |
| factory | 25 | 7 | 15 | 47 |
| curve | 25 | 9 | 34 | 68 |
| feeEscrow | 11 | 4 | 8 | 23 |
| feePolicy | 7 | 3 | 3 | 13 |
| emergencyController | 7 | 4 | 7 | 18 |
| coordinator | 18 | 6 | 10 | 34 |
| locker | 9 | 3 | 5 | 17 |
| launchToken | 7 | 2 | 16 | 25 |

Registry SHA-256 before and after a second generation:

`cbc7593265f813421cf20488c21a7f1f051c40bc5d3ca10ae17055bfb28debe4`

`git diff --check` passed. No ABI entry was manually invented or edited.

## Local verdict

`DAY6_TASK1_EXACT_LOCAL_VERIFICATION = PASS`

`DAY6_TASK1_GUARDED_ACCEPTANCE = NOT_CLAIMED_PENDING_FRESH_EXACT_HEAD_GITHUB_CI_AND_MERGE`

`DAY6_TASK2 = BLOCKED_BY_TASK1_ACCEPTANCE_GATE`
