# Bread UI/UX v2.2 — Token/Trade Recovered Handoff

Recovered after chat rollover on 16 Aug 2026.

## Authority / purpose

This handoff reconciles the stale living handoff after PR #94 advanced beyond the previously recorded Pending-graduation checkpoint. It records implementation/evidence only. It does not amend protocol, economic, Arc/USDC, security, or UI semantics.

Controlling source pack remains `v1.6-pre-rc-ui-ux-v2.2`, ratified. `CURRENT-BUILD-STATE` and `docs/current-build-state.yaml` remain the living workflow pointers under 06H.

## Reconstructed repository position

- Repository: `Dtwosam/bread`
- UI branch / PR: `agent/ui-ux-v2-2-implementation` / PR #94 — draft, open, unmerged
- PR base: `day9/synthra-arc-testnet-v3-candidate` @ `18952b20a56021350000c0f5d89552380c883be3`
- Previously recorded Pending handoff head: `db8111cf0d873a46394e6afe467d5e53ae61950b`
- Recovered accepted code-bearing head: `a5ddf6fe3f5f60b43e2d8671948e4e59e96143ee`
- Delta from prior handoff: 36 commits ahead, 0 behind
- Day 9 remains INCOMPLETE; no RC tag; Day 10 not started.
- Protected LAN environment `/tmp/bread-synthra-fork-proof` remains DO NOT TOUCH.

## Recovered accepted Token/Trade work after the stale handoff

### Processing / Graduating treatment

Recovered TDD sequence includes test REDs and the minimum UI implementation that:

- labels Processing as `Graduating`;
- explains that the bonding curve is complete while liquidity creation is in progress;
- disables invalid curve trading during that state;
- preserves already-completed trade state rather than presenting it as failed.

### Graduated treatment

Recovered TDD sequence includes source-backed graduated lifecycle presentation and the canonical graduated route/venue context without reopening protocol semantics.

### TradePanel canonical context

Recovered work includes the exact screenshot-era implementation and follow-up fixes:

- `7e2ef1b...` / `c40312b...` / `10fa7cd...` / `af5f409...` — RED coverage for balance, route, CTA, mobile and fast contract expectations.
- `a535acc...` — expose canonical trade-panel context.
- `3484d2665ca74ab85b3ea571eca33bb2cf93b355` — render trade balance, route and ticker-aware CTA.
- `dc886226e73b544094446c69b5e82f45a7a1acf9` — handle missing indexed token symbol safely.
- `d3fcf2e...` plus retained tests — align spendable balance beside the amount label and preserve responsive behavior.

Current behavior at the recovered code head includes:

- canonical spendable asset balance beside the amount label;
- Buy presets `$25 / $50 / $100 / MAX` and Sell presets `25% / 50% / 75% / MAX`;
- reviewed route label (`Bonding curve` or `Uniswap V3`);
- expected/minimum output, fee/tax, price-impact and slippage context;
- ticker-aware reviewed CTA (`Buy TICKER` / `Sell TICKER`), with safe fallback if symbol is missing;
- mobile/tablet trade sheet and persistent mobile Buy/Sell actions;
- graduation-in-progress route disabling.

### Stale-quote refresh safety

Recovered TDD sequence adds final canonical re-read handling:

- a materially changed review invalidates the approved review;
- the wallet is not opened with stale values;
- the public CTA becomes `Refresh Quote`;
- the user is told values changed and must refresh before signing.

### Transaction explorer link

Recovered TDD sequence adds canonical Arcscan transaction links for persisted/submitted transaction hashes and design-token styling for the link.

## Exact-head evidence at recovered code head

All observed workflows for `a5ddf6fe3f5f60b43e2d8671948e4e59e96143ee` completed successfully, including:

- root CI — run `31968847734`
- Token page — run `31968847726`
- trade lifecycle — run `31968847697`
- wallet/network — run `31968847639`
- production gates — run `31968847802`
- frontend security — run `31968848020`
- rebuild/reconcile — run `31968847612`
- cross-browser — run `31968847626`
- 10k hot-launch capacity — run `31968847781`
- service rollback — run `31968847645`
- failure recovery — run `31968847823`
- Day-9 recovery drills — run `31968847700`
- release browser matrix — run `31968847608`
- `day9-final-rc-gate` workflow — run `31968847834`

The final-RC workflow being green does **not** establish Day-9 PASS. The physical-device gate, remaining v2.2 implementation/closure, and final unified-candidate gates remain open.

## Fresh source-backed next defect candidate

Readback of 04D and Arc reconciliation exposes the next narrow Token/Trade requirement:

- 04D requires a Buy `MAX` purchase to reserve enough USDC for Arc gas using a current estimate rather than draining the shared underlying balance.
- Arc reconciliation states native USDC and the ERC-20 USDC interface share one underlying balance, while Bread financial accounting uses the 6-decimal ERC-20 interface and native USDC pays gas.
- The current `readSpendableTradeBalance` implementation reads the raw ERC-20 `balanceOf` and returns it unchanged; Buy `MAX` copies that full value into the amount field.

Therefore the next safe production slice, **after the living DOCX/YAML handoff is synchronized and read back**, is:

1. re-read 04D, 07A/02 Arc-USDC compatibility, v2.2 §22/23, 06D/06H, and current trade runtime/wallet adapter;
2. write a focused RED proving Buy `MAX` reserves current estimated gas in the shared USDC balance while ordinary displayed balance remains canonical;
3. verify the RED fails for the intended missing reserve behavior;
4. implement the minimum owning change without altering protocol transaction construction or Sell MAX;
5. run focused + adjacent trade/wallet/mobile/recovery + exact-head CI/security/performance/load evidence before acceptance.

Do not guess a fixed gas buffer. Estimation and conversion must follow verified Arc/shared-USDC behavior and existing transaction preparation interfaces.

## Open gates retained

- `PHYSICAL_DEVICE_EXTERNAL_EXECUTION_REQUIRED`
- `UI_UX_V2_2_IMPLEMENTATION_AND_EVIDENCE`
- `EXPLORE_SEARCH_LANE3_SOURCE_SECURITY_DECISIONS`
- `CURRENT_PONS_FACTORY_SOURCE_PARITY` — reference/parity-claim gap only
- `PONS_V2_RUNTIME_REFERENCE` — reference evidence; do not guess
- `BREAD_PRODUCTION_ECONOMICS_CONFIG` — public/mainnet release gate
- `PONS_AUDIT_FINDINGS` — continuing security watch
- `ARC_MAINNET_VALUES` — official-publication mainnet gate

## Do not do

- Do not touch, stop, restart, reset, reconfigure or prune `/tmp/bread-synthra-fork-proof`.
- Do not merge/close PR #94, create the Day-9 RC tag, begin Day 10, or claim Day-9 PASS.
- Do not reopen accepted Token/Trade behavior without a demonstrated regression.
- Do not alter Solidity, protocol economics, custody, admin authority, DEX semantics or financial ledgers in the MAX UI/runtime slice.
- Do not invent a fixed Arc gas reserve, market-cap semantics, lifecycle boundaries, Search image policy, Recent/Trending Search semantics, performance evidence or physical-device evidence.
