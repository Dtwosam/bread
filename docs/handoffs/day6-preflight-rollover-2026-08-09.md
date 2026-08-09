# Day 6 — Preflight Rollover Handoff

Date: 2026-08-09

## Durable baseline

- Day 5 durable handoff PR: #32
- Day 5 durable handoff exact head: `31c3978580eaecc8f81282abdf86576f444692cc`
- Day 5 durable handoff CI: `31286212890` — all four repository jobs PASS
- Day 5 durable handoff merge / verified main: `4cc1ea7041abaa86402114321bf31e53aff8ea90`
- `DAY6_START_BASELINE = 4cc1ea7041abaa86402114321bf31e53aff8ea90`

Day 5 is durably closed with `DAY_5_GRADUATION_ADAPTER_LOCK_INTEGRATED_PASS`.

## Day-6 controlling scope

Per 06B/06C/06D/06E/06F/06I and the v1.5 implementation plan, Day 6 owns:

- shared event/API/domain types;
- canonical protocol SDK ABIs/address resolution/manifest validation;
- typed Buy, Sell, Launch, Launch+Buy, Claim, RetryGraduation transaction preparation/simulation/error decoding;
- transactional indexer ingestion/checkpoints/replay;
- durable projections including launch state, trades, fee events, creator rollups, holder snapshots, candles and token metrics;
- feed/search/token/trades/holders/portfolio/creator/status read API;
- delete-DB rebuild and reconciliation;
- API chain/freshness metadata;
- first meaningful concurrent read/replay/cache/realtime-fanout tests.

Chain remains authoritative. PostgreSQL, Redis, indexer and API are rebuildable read projections and must never become financial-write authority.

## Architecture decision already approved

The user approved the recommended Day-6 persistence direction:

`DAY6_INDEXER_ARCHITECTURE = TRANSACTIONAL_EVENT_JOURNAL_WITH_SYNCHRONOUS_PROJECTIONS`

Frozen intent:

1. Every canonical onchain event has a stable journal identity based on canonical chain/log identity (including chainId, transactionHash and logIndex; block/log ordering remains deterministic).
2. Event journal insertion, affected projection updates and finalized checkpoint advancement occur in one PostgreSQL transaction.
3. Overlap replay is idempotent and must not duplicate trades, credits, claims, admin events, graduation outcomes, rollups or metrics.
4. Cache invalidation/realtime publication happens only after durable DB commit.
5. Full rebuild starts from the deployment block, reconstructs the journal/projections, and emits an explicit reconciliation result.
6. Realtime is convenience only. Clients must deduplicate/refetch after disconnect. Fanout is by logical channel rather than one chain subscription per browser.

Alternatives rejected for Day 6:
- direct-to-projection indexing with no durable journal: weaker replay/debug/reconstruction evidence;
- asynchronous journal/projection workers: unnecessary queue/projection-lag/ordering complexity for the current public-beta path.

## Source-derived canonical identities and minimum data model

06B controls these identities:

- Network: `chainId`
- Protocol stack: `chainId + stackVersion + factoryAddress`
- Launch: `chainId + tokenAddress`
- Curve: `curveAddress` linked one-to-one with launch
- Trade/event log identity: `chainId + transactionHash + logIndex`
- Creator: wallet address
- Graduated pool: `chainId + adapter-defined pool identifier/address`

Minimum Day-6 table families from 06B:

- protocol_stacks
- launches
- launch_state
- trades
- fee_credits
- fee_claims
- creator_rollups
- holder_snapshots
- market_candles
- token_metrics
- indexer_checkpoints
- admin_events
- metadata (sanitized display data, separate from financial state)

The selected event journal is an additional rebuild/audit primitive supporting these source-defined projections; it must not become a second financial authority.

## Existing repository state inspected at DAY6_START_BASELINE

- `@bread/types`: only `ChainId` and `Address` bootstrap types.
- `@bread/protocol-sdk`: bootstrap-only plus Pons live-reconciliation helper.
- `@bread/db`: explicitly `schema-not-started`.
- `@bread/indexer`: package exists with viem/pino but no Day-6 implementation.
- `@bread/api`: Fastify/pino package exists but no Day-6 route implementation.
- `@bread/config`: existing manifest validation package; must remain the single manifest/config authority.
- Actual Day-1-Day-5 contract event surfaces already exist and must be consumed rather than reinterpreted: Factory launch/config/buy events, curve trade/opening-protection/fee/graduation events, FeeEscrow credit/claim events, GraduationCoordinator sweep/completion/rescue/dust events, EmergencyController restriction/admin events.

## Day-6 API contract from 06B

Required public read endpoints:

- `GET /v1/feed`
- `GET /v1/search`
- `GET /v1/tokens/:address`
- `GET /v1/tokens/:address/trades`
- `GET /v1/tokens/:address/holders`
- `GET /v1/portfolio/:address`
- `GET /v1/creators/:address`
- `GET /v1/status`

Rules:
- financial actions remain wallet/SDK/onchain; API is read-only;
- indexed responses include chain/freshness metadata;
- address/pagination inputs are validated and bounded;
- search has separate rate limiting from cached feed reads.

## Day-6 reconciliation contract

`reconcile --network arc-testnet --stack <version>` must check at least:

- launch count vs Factory events;
- curve tracked reserves vs indexed state;
- FeeEscrow controlled balance vs outstanding claims;
- graduation state vs events/contracts;
- deployment addresses/code hashes;
- checkpoint continuity;

Result is PASS or an explicit mismatch report. Reconciliation is evidence that chain/indexer/application still represent one system.

## Required Day-6 end gate

- `DELETE_DB_REBUILD_PASS`
- `OVERLAP_REPLAY_IDEMPOTENT`
- `API_FRESHNESS_METADATA_PRESENT`
- `RECONCILE_PASS`
- first meaningful concurrent read/replay/cache/fanout tests PASS
- full prior repository regressions remain green

## Exact next action for the fresh chat

1. Verify GitHub `main` still equals or is a clean descendant of `DAY6_START_BASELINE = 4cc1ea7041abaa86402114321bf31e53aff8ea90`; if it moved, reconcile every intervening commit before proceeding.
2. Read the controlling Project Sources first, prioritizing 06B, 06C, 06D, 06E, 06F and 06I plus the master v1.5 source.
3. Reinspect actual Day-1-Day-5 contract events/interfaces/manifests on the verified main.
4. Complete the Day-6 design around the already-approved transactional journal + synchronous projection architecture. Freeze event normalization, finality/reorg handling, schema ownership, freshness envelope, cache/fanout semantics, reconciliation and failure behavior. Surface only genuine unresolved source gaps.
5. Write and commit `docs/superpowers/specs/2026-08-09-day6-sdk-indexer-api-design.md` and self-review for placeholders, contradictions, scope and ambiguity.
6. Respect the required written-spec review gate; no Day-6 production code before the design/spec gate is complete.
7. Invoke the writing-plans workflow and write a detailed RED→GREEN Day-6 implementation plan.
8. Execute small integrated lanes from the verified Day-6 baseline, preserving one canonical ABI/address/domain/config interpretation across SDK → indexer → API.

## Do not do

- Do not start Day-6 code from chat memory alone.
- Do not make database/indexer/API authoritative for balances, reserves, fees, ownership or graduation.
- Do not create a second ABI/address/config/domain interpretation outside shared packages.
- Do not route user financial writes through the Bread API.
- Do not postpone first concurrency/cache/fanout proof to Day 8.
- Do not guess production economics/admin addresses, Arc mainnet values, or canonical Arc DEX addresses.
- Do not reopen accepted Day-1-Day-5 financial semantics without newly ratified source authority.
