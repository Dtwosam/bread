# Automatic Graduation Keeper

## Purpose

Bread's public product never assigns graduation completion or retry ownership to a creator or ordinary user. The threshold-crossing trade performs the protocol-defined best-effort automatic graduation attempt. When the canonical indexed lifecycle remains `processing` / graduation-pending after that attempt, this operator service repeatedly re-derives the permissionless next graduation transition from fresh onchain state, simulates it, and submits it until the coordinator reaches a terminal state.

`CREATOR_MANUAL_GRADUATION = FORBIDDEN` for the Bread product UX. A user-wallet retry button is not an operational fallback.

## Authority boundary

The keeper account is an unprivileged automation EOA used only to pay gas for permissionless coordinator transitions. It must not hold Protocol Admin, Guardian, treasury, fee-recipient, deployment, or other privileged roles. Existing coordinator snapshot, exactly-once, retry, and permanent-liquidity invariants remain authoritative; this service does not change economics, destinations, adapters, or launch snapshots.

## Secret handling

Use a dedicated secret file outside the repository. Never commit, log, paste into chat, expose to the frontend, or place a production keeper private key in CI configuration.

The container receives only the file path through `BREAD_GRADUATION_KEEPER_PRIVATE_KEY_FILE=/run/secrets/graduation_keeper_private_key`. The runner also accepts direct `BREAD_GRADUATION_KEEPER_PRIVATE_KEY` for bounded local operation, but the two inputs are mutually exclusive and the deployment descriptor deliberately uses the file-mounted secret path.

The secret must contain one `0x`-prefixed 32-byte EOA private key and should be readable only by the service operator/runtime. Keep only enough native gas on the keeper EOA for permissionless graduation execution.

## Required runtime configuration

Set:

- `BREAD_API_BASE_URL` to the real Bread read API reachable from the keeper host.
- `BREAD_STACK_VERSION` to the exact deployed stack being serviced.
- `BREAD_GRADUATION_KEEPER_SECRET_FILE` to the host path of the dedicated keeper key file.
- Optionally `BREAD_NETWORK_MANIFEST_PATH` and `BREAD_DEPLOYMENT_MANIFEST_PATH`; the Compose descriptor defaults to the repository's Arc Testnet canonical manifests.
- Optionally `BREAD_GRADUATION_KEEPER_POLL_MS`; default is 15000 ms and the runner accepts 1000–300000 ms.

## Start / stop

From the repository root, after setting the required environment variables:

```sh
docker compose -f infra/docker/graduation-keeper.compose.yaml up -d --build
```

Inspect structured service output with:

```sh
docker compose -f infra/docker/graduation-keeper.compose.yaml logs -f graduation-keeper
```

Stop the service with:

```sh
docker compose -f infra/docker/graduation-keeper.compose.yaml down
```

The service is configured `restart: unless-stopped`; host/container restarts therefore do not turn a transient graduation failure into creator-owned work.

## Expected behavior

Each pass fetches the canonical indexed processing/graduating candidates, deduplicates them, then re-checks each candidate onchain before acting. Every next transition is simulated before submission. Transactions execute sequentially with the dedicated keeper account to avoid nonce races. A transient RPC, adapter, or transaction failure remains retryable on the next pass; no creator action is requested.

A terminal result is logged as `TERMINAL`. A transient/nonterminal result is logged as `RETRY_REQUIRED`; investigate recurring failures through normal monitoring/incident procedures rather than exposing a manual public retry control.

## Deployment gate

Source code, Compose wiring, and tests prove that Bread has a deployable automatic retry runtime. They do not by themselves prove that a particular production/testnet host is currently running it. Before claiming an environment has autonomous retry, verify the service is deployed there, the dedicated unprivileged EOA is gas-funded, configuration points to the intended canonical stack, and logs/chain state demonstrate a real keeper pass.
