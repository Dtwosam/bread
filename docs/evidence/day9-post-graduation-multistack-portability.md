# Day 9 — post-graduation multi-stack portability gate

Status: **CURRENT SINGLE-STACK PATH SAFE / SECOND-STACK CONTEXT REGISTRY REQUIRED BEFORE ROLLOVER**

This document records a forward-compatibility requirement discovered during the post-graduation V3 trading review. It does not claim a current Day-9 defect and does not authorize a second deployment.

## Controlling requirement

Bread's source of truth requires old protocol-stack versions to remain independently operable after a newer stack is deployed. Existing launches must remain tied to the stack and launch snapshots under which they were created.

## Current Day-9 browser state

The Arc Testnet browser currently resolves one verified `arcProtocolContext` from:

- `config/networks/arc-testnet.json`; and
- `config/deployments/arc-testnet.day5.json`.

`WalletTradeProvider` supplies that same context to every token trade experience.

This is correct for the current Day-9 environment because the repository retains only one verified Arc Testnet deployment manifest and all current public testnet launches belong to that stack.

`tests/day9/browser-protocol-context.test.ts` pins the browser context to the same canonical Day-9 stack identity as the LAN runtime and to the verified Day-9 factory/deployment start block.

## Existing per-launch identity

The indexed token model already carries the non-financial identity needed for future context selection:

- `stackVersion`
- `factoryAddress`

It also carries the launch-snapshotted coordinator/adapter/config fields as indexed display/projection data.

These indexed fields must never become transaction authority. They may only select a candidate from a locally verified context registry; the selected factory must then prove the token association onchain through canonical `getLaunch(token)` before any trade route is returned.

## Current fail-closed protection

`resolveCanonicalTradeRoute` always reads `getLaunch(token)` from the selected verified context's factory first and requires the returned launch token to equal the requested token.

`tests/day9/post-graduation-multistack-fail-closed.test.ts` pins the boundary:

- a token that does not belong to the selected verified factory is rejected with canonical launch-token mismatch;
- no coordinator, curve, adapter, router, quoter or pool read occurs after that mismatch.

Therefore a stale/wrong current context fails closed rather than silently routing an old token through the newest stack.

## Required design before a second stack is introduced

Before Bread deploys a second independently operable Arc stack, browser/runtime configuration must evolve from one global protocol context to a **verified protocol-context registry**.

The registry must:

1. retain every still-supported deployment manifest rather than replacing the prior one;
2. bind each retained deployment to its exact stack version, factory and chain identity;
3. retain the periphery dependencies needed by that stack's graduated adapter family;
4. select a candidate context using token `stackVersion` + `factoryAddress` only as non-authoritative lookup hints;
5. fail closed if no unique locally verified context matches those hints;
6. call that candidate factory's canonical `getLaunch(token)` and verify the returned token/factory relationship before any money-path read or write;
7. continue using the launch-snapshotted coordinator/adapter/family/config hash for route selection;
8. never fall back to "latest deployment" merely because an old context is unavailable;
9. preserve transaction persistence/recovery identity across stack versions;
10. add multi-stack browser/unit regression evidence before the second stack is activated.

No duplicate financial ledger, alternate indexer authority or vendor-specific routing table is permitted.

## Why no production change is made now

There is currently no second verified Arc Testnet deployment manifest to register. Building a speculative registry now would add unexercised configuration complexity without improving the current single-stack money path.

The correct current behavior is therefore:

- keep the verified Day-9 global context;
- retain the explicit wrong-context fail-closed test;
- treat context-registry implementation as a mandatory precondition of the **second stack deployment**, not as a Day-9 V3 closeout blocker.

## Classification

`CURRENT_DAY9_SINGLE_STACK_CONTEXT_VALID_SECOND_STACK_REQUIRES_VERIFIED_CONTEXT_REGISTRY`
