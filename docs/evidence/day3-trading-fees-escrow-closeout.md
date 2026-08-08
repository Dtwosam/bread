# Day 3 — Trading, Fees & Escrow Integrated Closeout

Status: **POST-MERGE CLOSEOUT GATE**  
Repository: `Dtwosam/bread`  
Closeout branch: `checkpoint/day3-closeout`  
Implementation PR: `#8`

## Closeout condition

This closeout is intentionally built from `main`, after the guarded PR #8 integration attempt. The companion Foundry test `contracts/test/Day3CloseoutPresence.t.sol` imports the Day-3 production surface directly from the integration baseline.

Therefore this closeout cannot compile if `main` does not actually contain:

- `contracts/src/core/BreadBondingCurve.sol`
- `contracts/src/fees/BreadFeePolicy.sol`
- `contracts/src/fees/BreadFeeEscrow.sol`
- `contracts/src/interfaces/IBreadFeePolicy.sol`
- `contracts/src/interfaces/IBreadFeeEscrow.sol`

The closeout PR must pass the repository's complete four-job CI before merge. A successful closeout merge is the durable proof that Day 3 exists on the integrated baseline rather than only on an implementation branch.

## Accepted Day-3 production scope

- canonical 6-decimal ERC-20 USDC Buy/Sell;
- tracked-reserve accounting inherited from the accepted Day-2 core;
- quote-leg base fee and separate creator tax;
- snapshotted per-curve fee economics;
- source-derived partial final-buy clamp, token-side reprice, ceiling gross-up and exact refund;
- clamped-buy price-bound slippage semantics;
- sell closure at `readyToGraduate()`;
- no-buyback fee sweep;
- protocol/creator FeeEscrow credit handoff;
- pull claims with `totalOutstanding` solvency accounting;
- factory-only future creator-recipient rotation;
- live sweep-operator rotation without economic snapshot mutation.

## Security / invariant evidence included in the integrated implementation

- unauthorized credit/admin/sweep rejection;
- exact custody-before-credit verification;
- zero-recipient/zero-value rejection;
- donation as non-entitlement surplus;
- state-before-transfer claims;
- failed-token-transfer claim rollback;
- short-transfer token rejection;
- over-claim rollback;
- fuzzed and sequential escrow solvency;
- Buy and Sell slippage rollback;
- direct quote/token donation resistance;
- fuzzed Buy→Sell no-extraction property;
- fuzzed oversized final-buy reserved-floor/refund property;
- sequential Buy→Buy→Sell→donation→policy-update→sweep→claims accounting checks;
- FeeEscrow handoff failure rollback;
- creator-recipient rotation preserves already-credited claims.

## Explicitly excluded

This closeout does not authorize or claim implementation of:

- buyback / vesting;
- graduation transfer / DEX liquidity;
- Launch+Buy;
- anti-snipe production logic or a Bread decay formula;
- native quote handling;
- guessed live fee percentages;
- Arc mainnet constants;
- current-live Pons V2 parity.

## Remaining gates

- `CURRENT_PONS_FACTORY_SOURCE_PARITY`
- `BREAD_SNIPE_DECAY_FORMULA`
- `LIVE_RUNTIME_CONFIG`
- `PONS_AUDIT_FINDINGS`
- `ARC_MAINNET_VALUES`

## Verdict rule

Only after this closeout branch itself passes the complete repository CI and is merged into `main` may the durable Day-3 verdict be recorded as:

`DAY_3_TRADING_FEES_ESCROW_INTEGRATED_PASS`
