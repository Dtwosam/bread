# Bread Day 6 SDK, Indexer & API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Bread Day 6 as one integrated read stack from accepted Day-1–Day-5 contract events through canonical shared types/SDK, a PostgreSQL transactional event journal with synchronous projections, read-only Fastify APIs, Redis cache/fanout, deterministic rebuild, reconciliation, and the required Day-6 concurrency/replay gates.

**Architecture:** Arc and the accepted Bread contracts remain financial authority. The indexer discovers and decodes canonical chain logs, then atomically inserts previously unseen journal rows, synchronously updates deterministic PostgreSQL projections, and advances the stack checkpoint in one transaction. Redis/cache/realtime effects occur only after commit; the API is read-only and exposes typed freshness metadata; replay and delete-DB rebuild must produce the same projections and reconciliation result.

**Tech Stack:** Node `24.18.0`; pnpm `11.15.1`; TypeScript `7.0.2`; viem `2.55.8`; Drizzle ORM `0.45.2`; pg `8.22.0`; Fastify `5.10.0`; Zod `4.4.3`; Vitest `4.1.10`; Pino `10.3.1`; Redis client `redis@6.1.0`; PostgreSQL + Redis from `infra/docker/compose.yaml`; Foundry `v1.5.0` for exact contract artifacts.

## Global Constraints

- Verified plan baseline is merged `main` at `f734d6cee2deb447928f94e6928cba2ca51b9b12`.
- Controlling design: `docs/superpowers/specs/2026-08-09-day6-sdk-indexer-api-design.md`.
- `DAY6_INDEXER_ARCHITECTURE = TRANSACTIONAL_EVENT_JOURNAL_WITH_SYNCHRONOUS_PROJECTIONS`.
- Chain/contracts remain financial authority; PostgreSQL, indexer, Redis, API and journal are rebuildable read surfaces only.
- Canonical event identity is `(chainId, transactionHash, logIndex)`; trade identity uses the `CurveBuy`/`CurveSell` log identity.
- Journal insert + affected projection updates + committed checkpoint advancement occur in one PostgreSQL transaction.
- Cache invalidation and realtime publication occur only after durable DB commit.
- Arc committed blocks are treated as final; a checkpoint block-hash contradiction is an integrity incident that halts the stack and requires cross-provider verification/rebuild, never silent history rewrite.
- Do not guess Arc mainnet values, canonical Arc DEX addresses, Bread production economics/admin addresses, or exact-current Pons parity.
- Do not invent Buyback state/event support for the current stack; unavailable current-stack fields remain explicitly unavailable/omitted.
- JSON protocol amounts are lossless decimal strings; internal monetary arithmetic is integer/`bigint` only.
- No server signs, relays, queues, custodizes or submits user Launch/Buy/Sell/Claim/RetryGraduation transactions.
- API addresses and pagination are validated and bounded; search receives a separate tighter rate limit than cached feed reads.
- Realtime is convenience only; clients deduplicate by canonical event ID and refetch after disconnect.
- No browser/connection creates its own chain subscription. Fanout is by logical channel.
- Every accepted task must run its focused RED→GREEN tests plus impacted adjacent regressions and update the durable Day-6 handoff/checkpoint before a dependent task begins.
- Day-6 end gate requires `DELETE_DB_REBUILD_PASS`, `OVERLAP_REPLAY_IDEMPOTENT`, `API_FRESHNESS_METADATA_PRESENT`, `RECONCILE_PASS`, and `FIRST_MEANINGFUL_CONCURRENT_READ_REPLAY_CACHE_FANOUT_TESTS_PASS`.

---

## Planned file map

### Shared contract / SDK
- `packages/types/src/identity.ts` — canonical chain/domain identities and branded transports.
- `packages/types/src/events.ts` — normalized event union and event disposition.
- `packages/types/src/api.ts` — request/response/freshness/cursor contracts.
- `packages/types/src/reconciliation.ts` — typed reconciliation report.
- `packages/types/src/index.ts` — public exports.
- `packages/protocol-sdk/src/abi/generated.ts` — generated Bread ABI registry output.
- `packages/protocol-sdk/src/context.ts` — validated manifest → `ProtocolContext`.
- `packages/protocol-sdk/src/events.ts` — version-aware log decoding/disposition.
- `packages/protocol-sdk/src/builders.ts` — typed Launch/Launch+Buy/Buy/Sell/Claim/RetryGraduation preparations/simulations.
- `packages/protocol-sdk/src/errors.ts` — custom-error decoding.
- `scripts/abi/generate-bread-abi.mjs` — deterministic artifact-to-SDK generator.
- `scripts/abi/check-bread-abi.mjs` — drift gate.

### Database
- `packages/db/src/schema/event-journal.ts` — durable raw canonical events.
- `packages/db/src/schema/projections.ts` — source-defined Day-6 projection families.
- `packages/db/src/schema/index.ts` — schema exports.
- `packages/db/src/client.ts` — typed pg/Drizzle construction.
- `packages/db/src/indexer-repository.ts` — transactional journal/projection/checkpoint writes.
- `packages/db/src/read-repository.ts` — API read queries/cursors.
- `packages/db/drizzle/0001_day6_read_stack.sql` — initial Day-6 schema migration.

### Indexer
- `apps/indexer/src/config.ts` — validated runtime configuration.
- `apps/indexer/src/discovery.ts` — two-pass Factory/dynamic-address log discovery.
- `apps/indexer/src/normalize.ts` — transaction-local event correlation.
- `apps/indexer/src/reducers.ts` — deterministic synchronous projections.
- `apps/indexer/src/apply-range.ts` — one-transaction apply/checkpoint boundary.
- `apps/indexer/src/replay.ts` — overlap replay/rebuild orchestration.
- `apps/indexer/src/reconcile.ts` — chain-vs-projection reconciliation.
- `apps/indexer/src/post-commit.ts` — Redis generation invalidation/logical-channel fanout.
- `apps/indexer/src/index.ts` — worker/CLI entrypoint.

### API
- `apps/api/src/config.ts` — DB/Redis/runtime schemas.
- `apps/api/src/cache.ts` — read-through cache + single-flight + generation keys.
- `apps/api/src/freshness.ts` — shared freshness envelope creation.
- `apps/api/src/routes/*.ts` — eight required `/v1` endpoints.
- `apps/api/src/server.ts` — Fastify registration/rate limits/degraded state.
- `apps/api/src/index.ts` — process entrypoint.

### Tests / gates
- `tests/day6/shared-contract.test.ts`
- `tests/day6/sdk-builders.test.ts`
- `tests/day6/db-schema.test.ts`
- `tests/day6/launch-vertical.test.ts`
- `tests/day6/trade-vertical.test.ts`
- `tests/day6/fees-admin-graduation.test.ts`
- `tests/day6/holders-portfolio.test.ts`
- `tests/day6/replay-finality-cache-fanout.test.ts`
- `tests/day6/api-concurrency.test.ts`
- `tests/day6/rebuild-reconcile.test.ts`
- `scripts/validation/validate-day6-read-stack.mjs`
- `.github/workflows/ci.yml` — run Day-6 validation/tests without removing prior gates.

---

### Task 1: Freeze the canonical shared contract, ABI registry and protocol context

**Files:**
- Create: `packages/types/src/identity.ts`
- Create: `packages/types/src/events.ts`
- Create: `packages/types/src/api.ts`
- Create: `packages/types/src/reconciliation.ts`
- Modify: `packages/types/src/index.ts`
- Create: `scripts/abi/generate-bread-abi.mjs`
- Create: `scripts/abi/check-bread-abi.mjs`
- Create: `packages/protocol-sdk/src/abi/generated.ts`
- Create: `packages/protocol-sdk/src/context.ts`
- Create: `packages/protocol-sdk/src/events.ts`
- Modify: `packages/protocol-sdk/src/index.ts`
- Create: `tests/day6/shared-contract.test.ts`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `CanonicalLogIdentity`, `canonicalEventId()`, `FreshnessMetadata`, `ApiEnvelope<T>`, `DecodedBreadEvent`, `EventDisposition`, `ProtocolContext`, `decodeBreadLog()`.
- Consumes: exact Foundry artifacts from `contracts/out/**` and validated `@bread/config` manifests.

- [ ] **Step 1: Write the failing shared-contract tests**

```ts
import { describe, expect, it } from 'vitest';
import { canonicalEventId } from '../../packages/types/src/identity.js';
import { resolveProtocolContext } from '../../packages/protocol-sdk/src/context.js';
import { classifyBreadLog } from '../../packages/protocol-sdk/src/events.js';

describe('Day 6 canonical shared contract', () => {
  it('builds a stable chain/log identity', () => {
    expect(canonicalEventId({
      chainId: 5042002,
      transactionHash: `0x${'ab'.repeat(32)}`,
      logIndex: 7,
    })).toBe(`5042002:0x${'ab'.repeat(32)}:7`);
  });

  it('rejects a protocol context with undeclared addresses', () => {
    expect(() => resolveProtocolContext({ network: 'arc-testnet', stackVersion: 'missing' })).toThrow();
  });

  it('classifies ERC20 Approval as KNOWN_IGNORED', () => {
    expect(classifyBreadLog('LAUNCH_TOKEN', 'Approval')).toBe('KNOWN_IGNORED');
  });
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm exec vitest run tests/day6/shared-contract.test.ts
```

Expected: FAIL because the Day-6 identity/context/event modules do not exist.

- [ ] **Step 3: Implement exact canonical identity and API envelope types**

```ts
export type Address = `0x${string}`;
export type Hex32 = `0x${string}`;

export type CanonicalLogIdentity = {
  chainId: number;
  transactionHash: Hex32;
  logIndex: number;
};

export function canonicalEventId(id: CanonicalLogIdentity): string {
  if (!Number.isSafeInteger(id.chainId) || id.chainId <= 0) throw new Error('invalid chainId');
  if (!Number.isSafeInteger(id.logIndex) || id.logIndex < 0) throw new Error('invalid logIndex');
  return `${id.chainId}:${id.transactionHash.toLowerCase()}:${id.logIndex}`;
}

export type FreshnessMetadata = {
  chainId: number;
  stackVersion: string;
  indexedBlock: string;
  observedHeadBlock: string;
  indexedAt: string;
  state: 'fresh' | 'lagging' | 'degraded';
};

export type ApiEnvelope<T> = { data: T; freshness: FreshnessMetadata };
```

Define `DecodedBreadEvent` as a discriminated union using the **actual accepted event names** from Factory, curve, FeeEscrow, FeePolicy, EmergencyController, GraduationCoordinator, permanent locker, ERC-20 `Transfer`, and inherited `OwnershipTransferred`. Every integer payload field is `bigint` internally.

- [ ] **Step 4: Generate and check ABIs from exact Foundry artifacts**

`generate-bread-abi.mjs` must read concrete accepted contract artifacts, extract ABI arrays, sort contract registry keys deterministically, and write only `packages/protocol-sdk/src/abi/generated.ts`. `check-bread-abi.mjs` regenerates to memory and exits nonzero if checked-in output differs.

Add root scripts:

```json
{
  "scripts": {
    "abi:generate": "node scripts/abi/generate-bread-abi.mjs",
    "abi:check": "node scripts/abi/check-bread-abi.mjs",
    "test:day6": "vitest run tests/day6"
  }
}
```

Add `pnpm abi:check` and `pnpm test:day6` to CI after existing validation/test steps.

- [ ] **Step 5: Implement validated protocol context and event disposition**

```ts
export type EventDisposition = 'INDEXED_CANONICAL' | 'KNOWN_IGNORED' | 'UNKNOWN';

export type ProtocolContext = {
  chainId: number;
  stackVersion: string;
  factoryAddress: Address;
  quoteAsset: Address;
  deploymentStartBlock: bigint;
  addresses: Readonly<Record<string, Address>>;
};
```

`resolveProtocolContext()` must consume the existing `@bread/config` validated manifest source; no copied testnet address table is allowed. `classifyBreadLog()` returns `KNOWN_IGNORED` for token `Approval`, canonical for registered event names, and `UNKNOWN` for unregistered topics/events on a known Bread contract version.

- [ ] **Step 6: Run GREEN + adjacent gates**

```bash
pnpm abi:generate
pnpm abi:check
pnpm exec vitest run tests/day6/shared-contract.test.ts
pnpm typecheck
pnpm build
```

Expected: PASS; generated ABI check leaves the tree clean after regeneration.

- [ ] **Step 7: Commit Task 1 and update Day-6 handoff**

```bash
git add packages/types packages/protocol-sdk scripts/abi tests/day6/shared-contract.test.ts package.json .github/workflows/ci.yml pnpm-lock.yaml docs/current-build-state.yaml docs/handoffs

git commit -m "feat(day6): freeze shared protocol contract"
```

---

### Task 2: Add direct-wallet SDK builders, simulation and custom-error decoding

**Files:**
- Create: `packages/protocol-sdk/src/builders.ts`
- Create: `packages/protocol-sdk/src/errors.ts`
- Modify: `packages/protocol-sdk/src/index.ts`
- Create: `tests/day6/sdk-builders.test.ts`

**Interfaces:**
- Produces: `prepareLaunch`, `prepareLaunchAndBuy`, `prepareBuy`, `prepareSell`, `prepareClaim`, `prepareRetryGraduation`, `simulatePreparedTransaction`, `decodeBreadError`.
- Consumes: `ProtocolContext`, generated ABIs, actual current contract function signatures.

- [ ] **Step 1: Write RED tests for exact targets and no signing**

```ts
it('prepares Buy directly to the launch curve', () => {
  const tx = prepareBuy(context, {
    curve: curveAddress,
    quoteIn: 1_000_000n,
    minTokensOut: 10n,
    recipient: user,
  });
  expect(tx.to).toBe(curveAddress);
  expect(tx.value).toBe(0n);
  expect(tx.functionName).toBe('buy');
});

it('prepares Claim directly to FeeEscrow', () => {
  const tx = prepareClaim(context, { amount: 250_000n });
  expect(tx.to).toBe(context.addresses.feeEscrow);
  expect(tx.functionName).toBe('claim');
});

it('contains no account/private-key field', () => {
  expect(Object.keys(prepareSell(context, sellInput))).not.toContain('account');
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run tests/day6/sdk-builders.test.ts
```

- [ ] **Step 3: Implement builders against actual accepted signatures**

Builder return shape:

```ts
export type PreparedBreadTransaction = {
  to: Address;
  abi: readonly unknown[];
  functionName: string;
  args: readonly unknown[];
  value: 0n;
};
```

Exact function mappings:
- Launch → Factory `launchToken(LaunchParams)`.
- Launch+Buy → Factory `launchTokenAndBuy(LaunchParams,uint256,uint256,address)`.
- Buy → curve `buy(uint256,uint256,address)`.
- Sell → curve `sell(uint256,uint256,address)`.
- Claim → FeeEscrow `claim()` or `claim(uint256)`.
- RetryGraduation → Coordinator `sweep(address)` when launch phase is not graduated, then `createPool(address)` as the explicit stage-two operation; builder must not collapse two onchain transactions into a centralized server flow.

- [ ] **Step 4: Implement simulation/error decoding**

`simulatePreparedTransaction(publicClient, request, account)` uses viem `simulateContract`; it returns normalized request/result but never retains/signs with a key. `decodeBreadError(data, context)` tries only registered current/historical Bread ABIs and returns `{ contractRole, errorName, args } | { errorName: 'UnknownBreadError', data }`.

- [ ] **Step 5: Run GREEN + Task-1 regression**

```bash
pnpm exec vitest run tests/day6/shared-contract.test.ts tests/day6/sdk-builders.test.ts
pnpm typecheck
```

- [ ] **Step 6: Commit + handoff**

```bash
git add packages/protocol-sdk tests/day6/sdk-builders.test.ts docs/current-build-state.yaml docs/handoffs

git commit -m "feat(day6): add canonical transaction builders"
```

---

### Task 3: Create PostgreSQL journal, source-defined projections and transactional repository boundary

**Files:**
- Create: `packages/db/src/schema/event-journal.ts`
- Create: `packages/db/src/schema/projections.ts`
- Create: `packages/db/src/schema/index.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/indexer-repository.ts`
- Create: `packages/db/src/read-repository.ts`
- Modify: `packages/db/src/index.ts`
- Create: `packages/db/drizzle/0001_day6_read_stack.sql`
- Create: `tests/day6/db-schema.test.ts`

**Interfaces:**
- Produces: `createBreadDb(pool)`, `IndexerRepository.applyCanonicalRange()`, `ReadRepository`, schema tables.
- Consumes: canonical types from Task 1.

- [ ] **Step 1: Write RED integration test against Bread dev PostgreSQL**

```ts
it('deduplicates canonical journal identity', async () => {
  await repo.applyCanonicalRange(rangeWithOneLaunch);
  await repo.applyCanonicalRange(rangeWithOneLaunch);
  expect(await db.select().from(eventJournal)).toHaveLength(1);
});

it('rolls back journal, projection and checkpoint together', async () => {
  await expect(repo.applyCanonicalRange(rangeWithReducerFailure)).rejects.toThrow();
  expect(await journalCount()).toBe(0);
  expect(await launchCount()).toBe(0);
  expect(await checkpoint()).toBeNull();
});
```

- [ ] **Step 2: Start exact dev infrastructure and verify RED**

```bash
docker compose -f infra/docker/compose.yaml up -d --wait --wait-timeout 60
pnpm exec vitest run tests/day6/db-schema.test.ts
```

Expected: FAIL because Day-6 schema/repository are absent.

- [ ] **Step 3: Implement schema with exact table families**

Create:
- `event_journal`
- `protocol_stacks`
- `launches`
- `launch_state`
- `trades`
- `fee_credits`
- `fee_claims`
- `creator_rollups`
- `holder_snapshots`
- `market_candles`
- `token_metrics`
- `indexer_checkpoints`
- `admin_events`
- `metadata`

Key constraints:

```sql
PRIMARY KEY (chain_id, transaction_hash, log_index)
UNIQUE (chain_id, token_address)
UNIQUE (chain_id, curve_address)
```

`indexer_checkpoints` is keyed by `(chain_id, stack_version, factory_address)` and stores committed block number/hash, applied timestamp, decoder version and status.

All onchain `uint*` monetary values use PostgreSQL `numeric(78,0)` or exact decimal text converted to `bigint` at repository boundaries; never `double precision`.

- [ ] **Step 4: Implement one transactional write boundary**

```ts
export type ApplyCanonicalRangeInput = {
  context: ProtocolContext;
  fromBlock: bigint;
  toBlock: bigint;
  toBlockHash: Hex32;
  events: readonly DecodedBreadEvent[];
};

export type ApplyCanonicalRangeResult = {
  insertedEventIds: readonly string[];
  checkpointBlock: bigint;
};
```

`applyCanonicalRange()` starts one Drizzle transaction, locks the checkpoint row, validates contiguous range, inserts journal rows with conflict-ignore, applies reducers **only for rows actually inserted**, advances checkpoint last, then commits.

- [ ] **Step 5: Run GREEN + migration repeatability**

```bash
pnpm exec vitest run tests/day6/db-schema.test.ts
pnpm typecheck
pnpm build
```

Run migration against an empty DB twice through the repository migration command; second run must be a clean no-op.

- [ ] **Step 6: Commit + handoff**

```bash
git add packages/db tests/day6/db-schema.test.ts docs/current-build-state.yaml docs/handoffs

git commit -m "feat(day6): add transactional read-model schema"
```

---

### Task 4: First vertical slice — Factory launch discovery → journal → launch projections → `/v1/status`, `/v1/feed`, `/v1/tokens/:address`

**Files:**
- Create: `apps/indexer/src/config.ts`
- Create: `apps/indexer/src/discovery.ts`
- Create: `apps/indexer/src/normalize.ts`
- Create: `apps/indexer/src/reducers.ts`
- Create: `apps/indexer/src/apply-range.ts`
- Create: `apps/api/src/freshness.ts`
- Create: `apps/api/src/routes/status.ts`
- Create: `apps/api/src/routes/feed.ts`
- Create: `apps/api/src/routes/token.ts`
- Create: `apps/api/src/server.ts`
- Create: `tests/day6/launch-vertical.test.ts`

**Interfaces:**
- Produces: `discoverRange()`, `normalizeTransactionLogs()`, `applyRange()`, `createBreadApi()` and first read routes.
- Consumes: Tasks 1–3.

- [ ] **Step 1: Write RED fixture test reproducing constructor-mint ordering**

Fixture order in one transaction:
1. token `Transfer(0x0 → curve, supply)`;
2. Factory `LaunchCreated`;
3. optional Launch+Buy logs.

Assert the launch projection records initial supply from the constructor mint and immutable snapshot fields, then `/v1/tokens/:address` returns them with freshness metadata.

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run tests/day6/launch-vertical.test.ts
```

- [ ] **Step 3: Implement deterministic two-pass discovery**

```ts
export async function discoverRange(
  client: PublicClient,
  context: ProtocolContext,
  knownLaunchAddresses: readonly Address[],
  fromBlock: bigint,
  toBlock: bigint,
): Promise<readonly RpcLog[]>;
```

Pass 1 fetches Factory `LaunchCreated`. Pass 2 fetches core + previously known + newly discovered token/curve addresses in bounded chunks, deduplicates by canonical identity, and sorts `(blockNumber, transactionIndex, logIndex)`.

- [ ] **Step 4: Implement launch normalization/reducer**

Launch projection is created only from canonical `LaunchCreated` plus the same-transaction constructor mint and accepted immutable/snapshotted getters. Missing/contradictory constructor mint is an apply failure; no checkpoint advances.

- [ ] **Step 5: Implement freshness and first API routes**

```ts
export function buildFreshness(
  checkpoint: IndexerCheckpoint,
  observedHeadBlock: bigint,
  now: Date,
): FreshnessMetadata;
```

Routes:
- `GET /v1/status`
- `GET /v1/feed`
- `GET /v1/tokens/:address`

Every success envelope is `{ data, freshness }`. Unknown/malformed addresses return bounded 4xx responses without RPC fallback.

- [ ] **Step 6: Run GREEN + adjacent regression**

```bash
pnpm exec vitest run tests/day6/shared-contract.test.ts tests/day6/db-schema.test.ts tests/day6/launch-vertical.test.ts
pnpm typecheck
pnpm build
```

- [ ] **Step 7: Commit + handoff**

```bash
git add apps/indexer apps/api tests/day6/launch-vertical.test.ts docs/current-build-state.yaml docs/handoffs

git commit -m "feat(day6): index and serve canonical launches"
```

---

### Task 5: Trade normalization, candles and token metrics → trades/token/feed API

**Files:**
- Modify: `apps/indexer/src/normalize.ts`
- Modify: `apps/indexer/src/reducers.ts`
- Modify: `packages/db/src/indexer-repository.ts`
- Modify: `packages/db/src/read-repository.ts`
- Create: `apps/api/src/routes/trades.ts`
- Modify: `apps/api/src/routes/token.ts`
- Modify: `apps/api/src/routes/feed.ts`
- Create: `tests/day6/trade-vertical.test.ts`

**Interfaces:**
- Produces: canonical BUY/SELL trade rows, deterministic candle buckets, token metrics, `GET /v1/tokens/:address/trades`.

- [ ] **Step 1: Write RED correlation tests**

For BUY transaction order, cover:
- optional `CurveBuyRefunded`;
- `OpeningProtectionApplied`;
- `CurveBuy`.

Assert trade ID equals the `CurveBuy` log identity; refund and opening tax enrich that trade but do not create separate trade rows. Assert SELL identity equals `CurveSell` log identity.

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run tests/day6/trade-vertical.test.ts
```

- [ ] **Step 3: Implement transaction-local correlation**

```ts
export type NormalizedTrade = {
  id: CanonicalLogIdentity;
  side: 'BUY' | 'SELL';
  token: Address;
  curve: Address;
  actor: Address;
  recipient: Address;
  quoteAmount: bigint;
  tokenAmount: bigint;
  baseFee: bigint;
  creatorTax: bigint;
  openingTax: bigint;
  refund: bigint;
};
```

Correlation may only consume earlier unconsumed same-transaction logs from the same curve and matching actor/recipient fields. Ambiguous leftovers fail normalization rather than guessing.

- [ ] **Step 4: Implement deterministic projections**

Update `trades`, `market_candles` and `token_metrics` synchronously from newly inserted canonical events. Candle bucket start is integer floor of block timestamp to the supported bucket; values remain exact integer base units.

- [ ] **Step 5: Implement cursor-bounded trade API**

`GET /v1/tokens/:address/trades?limit=…&cursor=…` uses opaque signed/validated cursor payload containing stable sort keys; enforce the source-defined maximum page size from API config and reject malformed cursors.

- [ ] **Step 6: Run GREEN + launch regression**

```bash
pnpm exec vitest run tests/day6/launch-vertical.test.ts tests/day6/trade-vertical.test.ts
pnpm typecheck
```

- [ ] **Step 7: Commit + handoff**

```bash
git add apps/indexer apps/api packages/db tests/day6/trade-vertical.test.ts docs/current-build-state.yaml docs/handoffs

git commit -m "feat(day6): project canonical trades and market metrics"
```

---

### Task 6: Fee, admin and graduation projections → creator/status surfaces

**Files:**
- Modify: `apps/indexer/src/reducers.ts`
- Modify: `packages/db/src/indexer-repository.ts`
- Modify: `packages/db/src/read-repository.ts`
- Create: `apps/api/src/routes/creator.ts`
- Modify: `apps/api/src/routes/status.ts`
- Create: `tests/day6/fees-admin-graduation.test.ts`

**Interfaces:**
- Produces: `fee_credits`, `fee_claims`, `creator_rollups`, `admin_events`, graduation `launch_state`, `GET /v1/creators/:address`.

- [ ] **Step 1: Write RED authority tests**

Assert:
- Fee entitlement increases only from FeeEscrow `FeeCredited`.
- Claims reduce outstanding projection only from FeeEscrow `FeeClaimed`.
- upstream `FeesSwept`, `LaunchFeeCredited` and graduation dust events do **not** create duplicate claimable credits.
- `GraduationSwept`, `GraduationCompleted`, `GraduationRescued` drive the projection phase but cannot override contradictory contract reconciliation later.
- emergency/admin events populate `admin_events` in chain order.

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run tests/day6/fees-admin-graduation.test.ts
```

- [ ] **Step 3: Implement reducers and creator rollups**

Creator rollups are derived only from accepted launch/trade/FeeEscrow projections. Do not synthesize Buyback/vesting balances. Any absent current-stack capability is encoded by the API type as unavailable rather than zero if zero would imply authoritative absence.

- [ ] **Step 4: Implement creator/status responses**

`GET /v1/creators/:address` validates/canonicalizes the wallet, reads DB only, and includes freshness. `/v1/status` adds decoder/checkpoint/reconciliation/degraded-state fields without exposing secrets.

- [ ] **Step 5: Run GREEN + fee/accounting regressions**

```bash
pnpm exec vitest run tests/day6/fees-admin-graduation.test.ts tests/day6/trade-vertical.test.ts
pnpm typecheck
```

- [ ] **Step 6: Commit + handoff**

```bash
git add apps/indexer apps/api packages/db tests/day6/fees-admin-graduation.test.ts docs/current-build-state.yaml docs/handoffs

git commit -m "feat(day6): project fees admin and graduation state"
```

---

### Task 7: Holder snapshots and portfolio read model

**Files:**
- Modify: `apps/indexer/src/reducers.ts`
- Modify: `packages/db/src/indexer-repository.ts`
- Modify: `packages/db/src/read-repository.ts`
- Create: `apps/api/src/routes/holders.ts`
- Create: `apps/api/src/routes/portfolio.ts`
- Create: `tests/day6/holders-portfolio.test.ts`

**Interfaces:**
- Produces: holder balances from canonical launch-token `Transfer`, `GET /v1/tokens/:address/holders`, `GET /v1/portfolio/:address`.

- [ ] **Step 1: Write RED holder tests**

Cover constructor mint, user transfer, burn, zero-address rules, repeated overlap replay, and two tokens in one wallet. Assert no `Approval` affects holdings.

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run tests/day6/holders-portfolio.test.ts
```

- [ ] **Step 3: Implement transfer reducer**

For each newly inserted launch-token `Transfer`:
- zero sender → increase recipient only;
- zero recipient → decrease sender only;
- otherwise decrease sender and increase recipient;
- reject negative projected balance as an integrity error.

Persist exact balance + last canonical event identity; zero balances may be retained or deleted consistently, but pagination/result semantics must be deterministic.

- [ ] **Step 4: Implement bounded holders/portfolio endpoints**

Both endpoints use DB projections only, stable cursor order and freshness metadata; they never issue per-wallet/per-token RPC reads in the request path.

- [ ] **Step 5: Run GREEN + trade regression**

```bash
pnpm exec vitest run tests/day6/holders-portfolio.test.ts tests/day6/trade-vertical.test.ts
pnpm typecheck
```

- [ ] **Step 6: Commit + handoff**

```bash
git add apps/indexer apps/api packages/db tests/day6/holders-portfolio.test.ts docs/current-build-state.yaml docs/handoffs

git commit -m "feat(day6): add holder and portfolio projections"
```

---

### Task 8: Checkpoint integrity, overlap replay, Redis post-commit cache invalidation and logical fanout

**Files:**
- Create: `apps/indexer/src/replay.ts`
- Create: `apps/indexer/src/post-commit.ts`
- Create: `apps/api/src/cache.ts`
- Modify: `apps/indexer/package.json`
- Modify: `apps/api/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `tests/day6/replay-finality-cache-fanout.test.ts`

**Interfaces:**
- Produces: `replayOverlap()`, `verifyCheckpointAnchor()`, `PostCommitPublisher`, `BreadCache`.
- New pinned dependency: `redis@6.1.0` in API/indexer where required.

- [ ] **Step 1: Write RED replay/integrity tests**

Assert:
- replaying an overlapping range does not change journal/projection counts or aggregates;
- cache/fanout mock sees zero calls if DB transaction fails;
- cache/fanout occurs after successful commit;
- same channel invalidation is coalesced per applied range;
- checkpoint block number with different block hash halts with `CHECKPOINT_BLOCK_HASH_MISMATCH` and performs no projection rewrite.

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run tests/day6/replay-finality-cache-fanout.test.ts
```

- [ ] **Step 3: Add exact Redis client dependency and interfaces**

```bash
pnpm --filter @bread/api add --save-exact redis@6.1.0
pnpm --filter @bread/indexer add --save-exact redis@6.1.0
```

`PostCommitPublisher.publish(result)` receives only committed inserted event IDs + affected logical channels. Channels are e.g. `feed`, `token:<address>`, `creator:<address>`, `portfolio:<address>`; never a chain subscription per client.

- [ ] **Step 4: Implement cache generations and single-flight primitive**

Use generation keys such as `bread:v1:generation:feed` and namespace payload keys with generation + validated query. Invalidating a logical channel increments/deletes the generation **after commit**; Redis loss falls back to DB reads.

- [ ] **Step 5: Implement overlap replay and checkpoint anchor verification**

Replay may begin before the committed checkpoint by the configured bounded overlap, but existing journal PKs suppress reducer effects. `verifyCheckpointAnchor()` calls the RPC for the checkpoint block hash before continuation; contradiction enters degraded integrity state and stops ingestion.

- [ ] **Step 6: Run GREEN + DB/vertical regressions**

```bash
pnpm exec vitest run tests/day6/db-schema.test.ts tests/day6/launch-vertical.test.ts tests/day6/replay-finality-cache-fanout.test.ts
pnpm typecheck
```

- [ ] **Step 7: Commit + handoff**

```bash
git add apps/indexer apps/api pnpm-lock.yaml tests/day6/replay-finality-cache-fanout.test.ts docs/current-build-state.yaml docs/handoffs

git commit -m "feat(day6): make replay cache and fanout commit-safe"
```

---

### Task 9: Complete read API, search isolation, rate limits and first meaningful concurrency proof

**Files:**
- Create: `apps/api/src/routes/search.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/cache.ts`
- Create: `tests/day6/api-concurrency.test.ts`

**Interfaces:**
- Completes all eight required endpoints.
- Produces separate feed/search limiter buckets and bounded concurrent read behavior.

- [ ] **Step 1: Write RED concurrent-read tests**

Test at least:
- 100 concurrent identical cached feed requests collapse to one DB load per cache miss generation;
- search traffic cannot exhaust the feed limiter bucket;
- Redis unavailable → bounded DB fallback with no 500 storm;
- stale/degraded freshness remains present under fallback;
- malformed address/cursor/limit inputs are rejected before DB work;
- no route invokes an RPC client.

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run tests/day6/api-concurrency.test.ts
```

- [ ] **Step 3: Implement `GET /v1/search` with isolated limit policy**

Search matches sanitized metadata fields only. Cap term length and page size. Use deterministic normalized token/creator search ordering; search is read-only and never resolves financial state by metadata.

- [ ] **Step 4: Register all eight required routes and limiter/cache boundaries**

Required set:
- `GET /v1/feed`
- `GET /v1/search`
- `GET /v1/tokens/:address`
- `GET /v1/tokens/:address/trades`
- `GET /v1/tokens/:address/holders`
- `GET /v1/portfolio/:address`
- `GET /v1/creators/:address`
- `GET /v1/status`

- [ ] **Step 5: Run GREEN and record concurrency evidence**

```bash
pnpm exec vitest run tests/day6/api-concurrency.test.ts tests/day6/replay-finality-cache-fanout.test.ts
pnpm typecheck
```

Write evidence with exact test command/concurrency values under `docs/evidence/day6-first-concurrent-read-replay-cache-fanout.md`.

- [ ] **Step 6: Commit + handoff**

```bash
git add apps/api tests/day6/api-concurrency.test.ts docs/evidence/day6-first-concurrent-read-replay-cache-fanout.md docs/current-build-state.yaml docs/handoffs

git commit -m "feat(day6): harden read API concurrency and search"
```

---

### Task 10: Delete-DB rebuild and explicit reconciliation report

**Files:**
- Create: `apps/indexer/src/reconcile.ts`
- Modify: `apps/indexer/src/replay.ts`
- Modify: `apps/indexer/src/index.ts`
- Create: `tests/day6/rebuild-reconcile.test.ts`
- Create: `docs/evidence/day6-rebuild-reconcile.md`

**Interfaces:**
- Produces: `rebuildStack()`, `reconcileStack()`, CLI commands `rebuild` and `reconcile`.

- [ ] **Step 1: Write RED rebuild/reconciliation tests**

Fixture chain must prove:
- deleting all Day-6 DB rows and rebuilding from `deploymentStartBlock` recreates identical journal/projection digests;
- launch count equals Factory `LaunchCreated` events;
- curve tracked reserves equal indexed launch state at reconciliation head;
- FeeEscrow custody covers/equals controlled outstanding claim accounting according to accepted source semantics, with surplus reported separately rather than misattributed;
- graduation projection equals Coordinator/locker state;
- registered deployment addresses have expected runtime code hashes;
- checkpoint continuity has no gap/contradiction;
- any mismatch returns `FAIL` with typed mismatch rows, never a soft warning PASS.

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run tests/day6/rebuild-reconcile.test.ts
```

- [ ] **Step 3: Implement delete/rebuild**

`rebuildStack()` truncates only rebuildable Day-6 read-model tables for the selected stack, resets checkpoint to immediately before `deploymentStartBlock`, replays canonical logs through the same production `applyRange()` path, then runs reconciliation. It must not mutate contracts/manifests or use a separate reconstruction algorithm.

- [ ] **Step 4: Implement reconciliation checks**

Return:

```ts
export type ReconciliationReport = {
  status: 'PASS' | 'FAIL';
  chainId: number;
  stackVersion: string;
  checkedBlock: string;
  checks: readonly {
    id: 'REC-01' | 'REC-02' | 'REC-03' | 'REC-04' | 'REC-05' | 'REC-06';
    status: 'PASS' | 'FAIL';
    expected: string;
    actual: string;
    detail: string;
  }[];
};
```

Map the six IDs to launch count, curve reserves, FeeEscrow claims/custody, graduation, deployment code hashes, and checkpoint continuity.

- [ ] **Step 5: Run GREEN and capture evidence**

```bash
pnpm exec vitest run tests/day6/rebuild-reconcile.test.ts
```

Then run the bounded test-stack CLI against exact dev infrastructure and write command/output identity into `docs/evidence/day6-rebuild-reconcile.md`.

- [ ] **Step 6: Commit + handoff**

```bash
git add apps/indexer tests/day6/rebuild-reconcile.test.ts docs/evidence/day6-rebuild-reconcile.md docs/current-build-state.yaml docs/handoffs

git commit -m "feat(day6): add deterministic rebuild and reconciliation"
```

---

### Task 11: Day-6 validation gate, full exact-head CI, guarded merge and durable closeout

**Files:**
- Create: `scripts/validation/validate-day6-read-stack.mjs`
- Modify: `scripts/validation/validate-all.mjs`
- Modify: `.github/workflows/ci.yml`
- Create: `docs/evidence/day6-sdk-indexer-api-closeout.md`
- Create: `docs/handoffs/day6-post-closeout-<merged-main-short-sha>.md` only after the actual merge SHA exists.
- Modify: `docs/current-build-state.yaml`

**Interfaces:**
- Produces durable Day-6 PASS evidence only if all mandatory gates and prior regressions are green.

- [ ] **Step 1: Write validator assertions before declaring PASS**

`validate-day6-read-stack.mjs` must fail if:
- any required `/v1` route is absent;
- ABI drift check is absent/failing;
- any source-defined projection table is absent;
- event journal identity/checkpoint constraints are absent;
- API success envelope can omit freshness;
- production API has any transaction-submission route;
- Day-6 evidence lacks the exact mandatory gate strings;
- current build state claims Day 6 PASS before closeout evidence is present.

- [ ] **Step 2: Run focused full Day-6 suite**

```bash
pnpm abi:check
pnpm exec vitest run tests/day6
pnpm validate
pnpm typecheck
pnpm build
```

Expected: all PASS and build leaves tracked workspace clean.

- [ ] **Step 3: Run prior repository regressions**

```bash
pnpm test
cd contracts && forge test
```

Expected: all prior Day-1–Day-5 tests stay green.

- [ ] **Step 4: Record Day-6 closeout evidence from exact candidate head**

Evidence must include exact candidate SHA and exact results for:

- `DELETE_DB_REBUILD_PASS`
- `OVERLAP_REPLAY_IDEMPOTENT`
- `API_FRESHNESS_METADATA_PRESENT`
- `RECONCILE_PASS`
- `FIRST_MEANINGFUL_CONCURRENT_READ_REPLAY_CACHE_FANOUT_TESTS_PASS`

Also record API route coverage, ABI drift status, migration/rebuild identity, reconciliation report identity, and no-open-critical/high Day-6 review result.

- [ ] **Step 5: Push/open guarded PR and require exact-head repository CI**

Do not merge on a stale CI head. Verify all four repository jobs plus new Day-6 validation/test steps on the exact candidate head.

- [ ] **Step 6: Guarded merge**

Merge only with expected-head SHA protection after exact-head CI is green. Immediately verify `main` equals the returned merge SHA or a reconciled clean descendant.

- [ ] **Step 7: Durable post-merge handoff**

Create the handoff from **actual merged main**, record Day-6 verdicts, merge SHA, CI run, active blockers that remain release-only, and exact Day-7 next action. Run the docs-only handoff CI/guarded merge before treating Day 6 as durably closed.

---

## Plan self-review checklist

Before implementation begins, verify:

1. Every required Day-6 API endpoint maps to a task.
2. Every 06B table family plus the approved journal maps to Task 3 and at least one reducer/read consumer.
3. Actual contract event families map to the SDK registry and reducers; no synthetic Buyback semantics were introduced.
4. The constructor mint ordering problem is covered before launch projection acceptance.
5. Same-transaction buy refund/opening-tax correlation has a deterministic ambiguity failure path.
6. FeeEscrow events remain the only claim entitlement projection authority.
7. Replay dedup applies reducers only when journal insertion was new.
8. Checkpoint hash contradiction halts rather than rewrites history.
9. Redis/cache/fanout are post-commit/disposable and cannot block DB truth.
10. API routes are DB-only and never perform raw-RPC primary reads.
11. Rebuild uses the same ingestion/reducer path, starting at `deploymentStartBlock`.
12. Reconciliation covers launch count, reserves, FeeEscrow, graduation, code hashes and checkpoint continuity.
13. First meaningful concurrent read/replay/cache/fanout proof occurs on Day 6, not deferred to Day 8.
14. Every task has an explicit RED command, GREEN command, commit and durable handoff update.
15. No task guesses production economics/admin values, Arc mainnet values or canonical Arc DEX addresses.
16. No `TODO`, `TBD`, “implement later”, unspecified error-handling instruction, or undefined cross-task interface is permitted in this plan.

## Execution decision

The user has already instructed autonomous continuation and explicitly asked not to be interrupted for routine approvals where Project Sources determine the answer. This environment does not expose a separate subagent execution surface for repository writes, so after the plan gate is durably accepted the implementation will use **superpowers:executing-plans inline**, preserving the task-by-task RED→GREEN/review/commit checkpoints above.
