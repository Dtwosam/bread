# Day 6 Implementation Plan — Self-Review

Date: 2026-08-09

Plan under review:

`docs/superpowers/plans/2026-08-09-day6-sdk-indexer-api.md`

Plan commit before this self-review stamp:

`099dc787d29dae67f9dda7459d28c276a0328b21`

Integrated approved-spec baseline:

`f734d6cee2deb447928f94e6928cba2ca51b9b12`

## Verdict

`DAY6_IMPLEMENTATION_PLAN_SELF_REVIEW = PASS_WITH_CONTROLLING_SPEC_CORRECTIONS`

The plan covers the full approved Day-6 scope, but self-review found two shorthand mismatches and several places where the approved design is more specific than the plan prose. The approved design remains controlling. The following corrections are mandatory execution semantics and supersede only conflicting shorthand in the plan.

## Corrections

### 1. API response envelope

Use the approved design shape exactly:

```ts
type IndexedResponse<T> = {
  data: T;
  meta: FreshnessMeta;
  page?: CursorPageMeta;
};
```

Do **not** implement the plan shorthand `{ data, freshness }`.

`FreshnessMeta` must include at least:

- `chainId`;
- API/indexer schema version;
- indexed-through block number as a decimal string;
- indexed-through block hash;
- indexed-through block timestamp;
- `servedAt`;
- `source: "bread-indexer"`;
- `status: "FRESH" | "LAGGING" | "REBUILDING" | "DEGRADED"`;
- optional observed Arc head and derived lag blocks;
- cache state where applicable;
- stack version for single-stack responses, while multi-stack feed items carry their own stack identity.

A cached response keeps the checkpoint metadata that produced it; only `servedAt` changes.

### 2. RetryGraduation

Use the approved phase mapping exactly:

- `NOT_GRADUATED` + ready curve -> prepare `GraduationCoordinator.sweep(token)`;
- `SWEPT` -> prepare `GraduationCoordinator.createPool(token)`;
- `POOL_CREATED` -> typed terminal/already-complete result, no transaction;
- `RESCUED` -> typed terminal/rescued result, no transaction.

The SDK never changes the snapshotted adapter/destination and never routes the operation through a Bread server.

### 3. Feed views and ordering

Implement the approved `GET /v1/feed` views exactly:

`view=new|trending|graduating|graduated`

Do not substitute a generic or guessed ranking. Preserve the approved deterministic source-defined ordering, including near-graduation ordering by progress bps, then `volume_usdc_1h`, launch time, and token address; `POOL_CREATED` graduation ordering remains completion block/log descending. Future sponsorship may not silently alter organic ordering.

### 4. Search

Preserve the approved search behavior:

- exact contract;
- exact creator wallet;
- normalized ticker exact/prefix;
- normalized name prefix;
- address-like queries may run immediately;
- text queries use the approximate two-character threshold from 04C;
- exact contract match outranks duplicate ticker/name results;
- no unbounded substring/offset scan;
- search keeps its separate stricter concurrency/rate-limit budget.

### 5. Portfolio

Do not fabricate PnL or average entry where external transfers make cost basis incomplete. Graduated tokens without a ratified live DEX price source expose price/value as unavailable or explicitly historical.

### 6. Metadata

Token/detail/search projections must use sanitized display metadata. Metadata never becomes a financial key or authority.

### 7. API errors and pagination

Use the approved structured `ApiError` shape, bounded versioned base64url cursor, canonical address parsing before DB work, no unbounded offsets, and 400/404/429/503/500 classes defined by the design.

### 8. FeeEscrow reconciliation

`REC-03` requires:

- onchain FeeEscrow custody `>= totalOutstanding`;
- surplus/donations are allowed and reported separately;
- projected `fee_credits - fee_claims == onchain totalOutstanding` at the checked block.

Do not require custody equality when surplus exists.

### 9. Initial Day-6 scale work

The first meaningful Day-6 scale proof must include concurrent reads, overlap replay, post-commit cache/fanout, slow-consumer containment, bounded search traffic, collapsed cache misses and no per-client Arc RPC fanout. Full 06I 10,000-client/p95/error-rate stress remains Day 8, not Day 6.

## Placeholder / consistency review

- No unresolved `TODO`, `TBD`, guessed mainnet address, guessed economics value or deferred financial-authority decision exists in the plan.
- All eight required API endpoints are mapped to tasks.
- All source-defined Day-6 table families plus the approved `event_journal` are mapped to schema/reducer/read tasks.
- Every implementation task has an explicit RED command, GREEN command, review/commit boundary and handoff update.
- Constructor-mint ordering, same-transaction buy correlation, FeeEscrow authority, overlap replay, checkpoint hash integrity, Redis post-commit semantics, rebuild and all six reconciliation families are explicitly covered.
- The approved design remains controlling whenever this plan uses shorter prose.

## Gate consequence

`DAY6_DETAILED_RED_GREEN_PLAN = SELF_REVIEWED`

Production implementation may begin only after this plan checkpoint itself passes repository CI and is integrated into `main`. The next execution workflow is `superpowers:executing-plans`, with `superpowers:test-driven-development` applied to each production task and `superpowers:verification-before-completion` before any PASS/merge claim.
