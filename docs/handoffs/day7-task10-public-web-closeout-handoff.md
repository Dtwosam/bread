# Day 7 Task 10 — Public Web Primary Journeys & Day-7 Closeout Handoff

Date: 2026-08-10

## Durable verdict candidate

`DAY_7_PUBLIC_WEB_PRIMARY_JOURNEYS_INTEGRATED_PASS_DURABILITY_PENDING`

This handoff is the small/current 06H continuation pointer for the completed Day-7 Task-10 implementation. Day 7 is not durably closed until the separate docs-only durability PR containing this file and `docs/current-build-state.yaml` passes its continuity matrix, guarded-merges, and the resulting `main` is freshly read back.

## Accepted implementation boundary

- Repository: `Dtwosam/bread`
- Starting durable main: `070a3f274d0ed26bfb1b38cb14b4364c8d7a376a`
- Task-10 branch: `agent/day7-task10-playwright-closeout`
- Task-10 implementation PR: #82
- Exact audited implementation head: `f1d74441abe06f11806e5b2fdf3ca7c012dc3024`
- Guarded implementation merge / actual post-implementation `main`: `171a646305f796e222fd3a9f34f4bd343e43983a`
- Task-10 evidence: `docs/evidence/day7-public-web-closeout.md`
- Durability branch: `docs/day7-task10-durable-handoff`
- Durability PR: pending assignment at this initial handoff commit

## What Task 10 proved

- Pinned Playwright 1.62.0 deterministic browser harness.
- Indexed API remains the primary browse/read authority; failed/degraded reads do not silently fall back to raw Arc RPC.
- Search keyboard containment/restoration and contract identity are browser-proven.
- Active, graduation-pending, graduated and permanent-lock evidence remain distinguishable.
- Real browser wallet connection, wrong-network switching, Buy, Sell, launch-only, atomic Launch + Buy and creator claim flows execute through the existing Bread SDK/wallet/transaction authorities.
- Zero claim produces no wallet write.
- Duplicate transaction submission remains locked while a saved transaction is unresolved.
- Persisted transaction state is visibly restored after refresh; a later recovery pass can confirm without a second wallet write; receipt transport failure surfaces `UNKNOWN` with the saved hash.
- Mobile trade flow meets the source-defined <=90dvh/internal-scroll/safe-area/touch-target gate and remains usable under deterministic keyboard-pressure viewport reduction.
- Bounded Firefox and WebKit browse + wallet-Buy smoke passed.
- The temporary E2E protocol deployment overlay restores the canonical unresolved Arc testnet deployment manifest byte-for-byte after every run.

## Demonstrated repairs

Task 10 repaired only browser-demonstrated frontend gaps:

1. `NOT_GRADUATED` + not-ready launches were incorrectly presented as Processing; they now remain Active.
2. The token trade panel did not consume the existing global persisted-transaction recovery state after refresh; recovered BUY/SELL state is now published through the existing runtime and displayed/locked by the panel.
3. A fast terminal recovery scheduling race could leave the panel at visible IDLE; first adoption of the recovered hash is now deterministic, while stale terminal recovery cannot overwrite a later user-started trade.

No new receipt-polling algorithm, storage schema, financial math, SDK transaction builder, ABI/address authority, API financial write, wallet-send authority, custody model, economics, admin/guardian authority or protocol lifecycle was introduced.

## Exact implementation-head verification

At `f1d74441abe06f11806e5b2fdf3ca7c012dc3024`:

- Task-10 primary browser workflow `31419035434` — PASS
  - retained Day-7 Task-3: 3 files / 9 tests PASS
  - Chromium: 22 passed / 12 skipped / 0 flaky
  - canonical manifest restoration PASS
- Firefox/WebKit probe `31419035708` — PASS
- root CI `31419035612` — PASS
- Day-7 Tasks 1, 2, 4, 5, 6, 7, 8 and 9 — PASS; Task 3 retained explicitly inside Task 10
- retained Day-6 Tasks 5–10 — PASS
- final source/security diff review — PASS

## Day-7 integrated status

Tasks 1–10 are implementation-complete. The accepted Day-7 product now contains the public foundation, indexed read boundary, Explore/Search, Token page, trade lifecycle, Create/Review/Launch, Portfolio/Creator/claims, wallet/network convergence, responsive/accessibility/performance/frontend-security convergence, and primary browser journey closeout.

Day 7 becomes `DAY_7_PUBLIC_WEB_INTEGRATED_PASS_DURABLE` only after this separate durability boundary merges.

## Unchanged blockers

- `CURRENT_PONS_FACTORY_SOURCE_PARITY`
- `PONS_V2_RUNTIME_REFERENCE`
- `BREAD_PRODUCTION_ECONOMICS_CONFIG`
- `PONS_AUDIT_FINDINGS`
- `ARC_MAINNET_VALUES`

Their existing typed scopes remain unchanged. Task 10 did not create an exact-current Pons parity claim, freeze Bread production economics, represent Pons audits as complete, or invent Arc mainnet/canonical DEX values.

## Next safe action after durability merge

Begin **Day 8 — Attack the System** from the exact durable Day-7 `main` only after this durability PR is exact-head green, guarded-merged and freshly read back.

Day 8 is stabilization/security/load/failure-injection work, not feature invention. Its controlling scope includes:

- extended fuzz/invariant suites;
- static analysis and focused security review of new/reconstructed money code;
- RPC/API/indexer/realtime failure injection;
- feed/search/realtime/indexer-catch-up load testing including the 06I hot-launch/bot-burst target;
- malicious metadata/CSP/sanitization checks;
- admin/guardian abuse attempts;
- verification that recovery behavior matches the runbook.

Do not begin Day 9/RC work or public-money release merely because Day 7 is complete. Day-8 mandatory security/capacity/recovery gates remain predecessors.
