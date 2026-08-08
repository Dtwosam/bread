# Checkpoint 7B bootstrap environment

Observed execution environment at bootstrap:
- Node available locally: v22.16.0 (not the pinned project runtime)
- npm available locally: 10.9.2
- pnpm unavailable locally; Corepack cannot reach npm registry from this execution sandbox
- Foundry unavailable locally
- Docker unavailable locally
- Git available: 2.47.3

Project target runtime is pinned separately in `config/toolchain/versions.json` and `.nvmrc`.

Consequences:
- dependency installation / lockfile generation cannot be proven in this sandbox yet
- Foundry compile cannot be proven in this sandbox yet
- Docker Postgres/Redis health cannot be proven in this sandbox yet
- dependency-free repository/manifests/gates/handoff/load-harness validation can be proven now
