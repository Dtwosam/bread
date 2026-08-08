# Bread

Bread is an Arc-first USDC token launchpad. This repository is being built from the Bread source-of-truth documents under strict continuity, security, portability, and load-testing gates.

## Current state

Checkpoint 7B bootstrap skeleton. Financial implementation is intentionally not started for unresolved Pons V2 components.

See:
- `docs/current-build-state.yaml`
- `config/protocol/build-gates.json`
- `config/networks/arc-testnet.json`
- `docs/handoffs/README.md`

## Safety rule

Do not implement snipe protection, Launch+Buy, FeeEscrow, or claim exact current-live Pons parity by assumption. The repository-visible gates must be closed with evidence first.
