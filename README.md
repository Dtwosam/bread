# Bread

Bread is an Arc-first USDC token launchpad. This repository is being built from the Bread source-of-truth documents under strict continuity, security, portability, and load-testing gates.

## Current state

Day 1 baseline/build-skeleton work is integrated. The repository has pinned tooling and dependencies, validated Arc manifests, Foundry/TypeScript build gates, PostgreSQL/Redis health proof, a frozen Pons public source/license inventory, and a read-only Pons V2 reconciliation reader.

Day 2 is limited to source-verified `LaunchToken` and `BondingCurveMath` work. Unresolved Pons V2 financial components remain blocked rather than guessed.

See:
- `docs/current-build-state.yaml`
- `config/protocol/build-gates.json`
- `config/protocol/pons-reference.json`
- `config/networks/arc-testnet.json`
- `docs/evidence/day1-pons-reference-reconciliation.md`
- `docs/handoffs/README.md`

## Safety rule

Do not implement snipe protection, Launch+Buy, FeeEscrow, or claim exact current-live Pons parity by assumption. The repository-visible gates must be closed with evidence first.
