# Day 9 Browser / Device / Wallet / Accessibility Matrix

Status: **AUTOMATED ENGINE MATRIX PASS — MACOS SAFARI PARTIAL PHYSICAL EVIDENCE; OTHER PHYSICAL / BRANDED EXECUTION REMAINS EXTERNAL**

This evidence distinguishes browser-engine automation and viewport emulation from actual branded-browser / physical-device execution. A Playwright WebKit run is not a macOS/iOS Safari execution claim, and mobile Chromium emulation is not a physical Android/iOS claim.

The controlling repaired pre-final integrated evidence is Day-9 Lane 6 run `31445491625` on head `5c0e6ce15af30f406a8c367dc906c188451406c8`, with retained Day-7 primary Playwright run `31445491601` and Day-9 recovery run `31445491591` also green on that same head. The recovery regression's deterministic fixture race was repaired without changing production recovery logic, assertions, or timeouts. Task 8 re-runs this matrix on its final blocked-verdict head before closeout.

| Target | Status | Evidence kind | Evidence |
| --- | --- | --- | --- |
| Desktop Chromium | PASS | AUTOMATED_BROWSER_ENGINE | Executed retained desktop journeys, including transaction recovery, on the repaired integrated head. |
| Desktop Firefox | PASS | AUTOMATED_BROWSER_ENGINE | Firefox-engine automation executed. This is an engine-automation claim only. |
| Desktop WebKit | PASS | AUTOMATED_BROWSER_ENGINE | WebKit-engine automation executed. This is not a Safari-branded claim. |
| Mobile Chromium emulation | PASS | EMULATION | Mobile Chromium emulation executed, including retained mobile keyboard-pressure trade coverage. This is not a physical-device claim. |
| macOS Safari | PARTIAL_PASS_EXTERNAL_USER_EXECUTION | EXTERNAL_EXECUTION | On 2026-08-11 the operator reported successful execution on actual macOS Safari against the Vercel `bread-web` staging deployment from `c21b49a1f8edaaad999e461edb0ce602071bda5c`: page/navigation/responsive sweep good; Rabby detected; wallet connected; wrong-network state surfaced; Arc Testnet add succeeded; switch to Arc Testnet succeeded; Bread recognized the switched network. Portfolio API data remained unavailable because the staging API/indexer was not deployed. Buy/Sell/Create/Claim transaction execution was not claimed because the protocol/DEX deployment context remains unresolved/fail-closed. |
| iOS Safari | EXTERNAL_EXECUTION_REQUIRED | EXTERNAL_EXECUTION | No physical/current iOS Safari execution evidence is available in the connected tooling. |
| Android Chrome physical | EXTERNAL_EXECUTION_REQUIRED | EXTERNAL_EXECUTION | No physical representative Android Chrome execution evidence is available in the connected tooling. |
| Desktop Edge | EXTERNAL_EXECUTION_REQUIRED | EXTERNAL_EXECUTION | No actual Microsoft Edge branded-browser execution has been performed; Chromium engine automation is not relabeled as Edge. |
| Wallet / in-app browsers | NO_FIRST_CLASS_WALLET_BROWSER_CLAIM | NOT_CLAIMED | Bread V1 claims generic injected EIP-1193 wallet behavior only; no brand-specific wallet/in-app browser compatibility claim is made without execution evidence. |

## Physical macOS Safari execution — 2026-08-11

Execution source: operator-reported external physical-browser execution. This is not represented as independently observed by GitHub or automated browser tooling.

Staging target: Vercel project `bread-web`, deployed from repository commit `c21b49a1f8edaaad999e461edb0ce602071bda5c`. GitHub recorded the `Vercel – bread-web` status as success before the physical execution began.

Reported results:

- Home / Explore / Create / Portfolio / Creator navigation and visual sweep: good; no reported blank pages, crashes, overlap, broken navigation, or unexpected horizontal scrolling while resizing Safari.
- Wallet chooser surfaced generic `Injected` plus detected `Rabby Wallet`, with the existing truthfulness notice that detection is not compatibility certification.
- Rabby wallet detection and connection: PASS for this execution.
- Connected-wallet state reflection in Bread: PASS for this execution.
- Wrong-network detection and `Switch to Arc` prompt: PASS for this execution.
- Arc Testnet add-to-wallet flow: PASS for this execution.
- Switch to Arc Testnet and post-switch Bread state recognition: PASS for this execution.
- Portfolio indexed-data retrieval: NOT PASSED / NOT ATTRIBUTED TO SAFARI. The staging frontend called same-origin Bread API routes while the staging API/indexer was not deployed, so `Portfolio unavailable` was observed and classified as an environment/backend limitation rather than a Safari rendering/connectivity failure.
- Buy / Sell / Create / Claim transaction execution: NOT EXECUTED / NOT CLAIMED. The canonical protocol/DEX deployment context remains unresolved and the browser runtime intentionally fails closed rather than synthesizing deployment values.

This evidence narrows the macOS Safari external-execution gap but does not convert the full supported-wallet release matrix to PASS. In particular, it does not establish first-class Rabby compatibility or satisfy transaction-path execution that is blocked on the canonical Arc Testnet protocol/DEX environment.

## Automated coverage proved

The automated matrix covers Explore/Search/Token; generic injected EIP-1193 wallet connect; wrong-network to Arc Testnet switch; Buy review/submit/recovery; Sell review/submit; Create and Launch+Buy; creator claim; graduation/permanent-lock visibility; keyboard navigation and visible focus on transaction controls; reduced-motion preference; and the retained mobile keyboard-pressure trade flow.

Canonical Arc manifests are restored byte-for-byte by the browser harness and independently guarded by CI.

## Release truthfulness boundary

Automated engine/emulation PASS plus the partial physical macOS Safari execution above does not convert the remaining physical/current-device rows to PASS and does not clear Safari transaction-path coverage that is still blocked by unresolved canonical protocol/DEX deployment prerequisites. Under the frozen Day-9 plan, the remaining `EXTERNAL_EXECUTION_REQUIRED` / externally blocked rows prevent the overall supported-matrix release gate from being declared PASS. Task 8 therefore remains `SUPPORTED_MATRIX = BLOCKED_EXTERNAL_EXECUTION_REQUIRED` until the required environments actually execute, the protocol-dependent portions can execute truthfully, or a controlling source amendment changes the requirement.
