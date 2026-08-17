# Graduation UX/runtime clarification — creator manual graduation forbidden

Status: product-owner clarification captured during the v1.6.1 closure pass.

## Invariant

`CREATOR_MANUAL_GRADUATION = FORBIDDEN`

Bread must not make a creator or ordinary user responsible for completing or retrying token graduation.

The accepted product flow is:

1. The threshold-crossing buy makes the token fully baked and the protocol performs its source-defined automatic graduation attempt.
2. If the external graduation path cannot complete, the crossing trade remains valid and the token remains safely retryable under the existing frozen graduation snapshot/routing invariants.
3. Bread's unprivileged operator keeper automatically advances the remaining permissionless coordinator transition(s), with retry after transient failure.
4. The public UI is status-only for graduation recovery: for example `Graduation pending`, `Processing` / `Graduating`, automatic retry pending, and `Graduated`.
5. There is no creator/user `Graduate`, `Complete graduation`, `Continue graduation`, or `Retry graduation` transaction control, and no user-wallet fallback for keeper failure.

## Supersession boundary

Earlier UI material that permitted a public manual retry when coordinator retry is permissionless is superseded for the Bread product experience by this clarification. Protocol-level permissionless retry remains intact; the change is ownership of retry execution, not a new privileged protocol role or a change to economics, snapshots, adapters, custody, fee routing, liquidity destinations, or admin authority.

The keeper signing account is therefore an unprivileged gas-paying automation EOA only. It must hold no Bread admin, guardian, treasury, deployment, or other privileged authority.
