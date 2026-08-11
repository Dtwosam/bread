# Day 9 Browser / Device / Wallet / Accessibility Matrix

Status: **AUTOMATED ENGINE MATRIX PASS — PHYSICAL / BRANDED EXECUTION REMAINS EXTERNAL**

This evidence distinguishes browser-engine automation and viewport emulation from actual branded-browser / physical-device execution. A Playwright WebKit run is not a macOS/iOS Safari execution claim, and mobile Chromium emulation is not a physical Android/iOS claim.

The controlling repaired pre-final integrated evidence is Day-9 Lane 6 run `31445491625` on head `5c0e6ce15af30f406a8c367dc906c188451406c8`, with retained Day-7 primary Playwright run `31445491601` and Day-9 recovery run `31445491591` also green on that same head. The recovery regression's deterministic fixture race was repaired without changing production recovery logic, assertions, or timeouts. Task 8 re-runs this matrix on its final blocked-verdict head before closeout.

| Target | Status | Evidence kind | Evidence |
| --- | --- | --- | --- |
| Desktop Chromium | PASS | AUTOMATED_BROWSER_ENGINE | Executed retained desktop journeys, including transaction recovery, on the repaired integrated head. |
| Desktop Firefox | PASS | AUTOMATED_BROWSER_ENGINE | Firefox-engine automation executed. This is an engine-automation claim only. |
| Desktop WebKit | PASS | AUTOMATED_BROWSER_ENGINE | WebKit-engine automation executed. This is not a Safari-branded claim. |
| Mobile Chromium emulation | PASS | EMULATION | Mobile Chromium emulation executed, including retained mobile keyboard-pressure trade coverage. This is not a physical-device claim. |
| macOS Safari | EXTERNAL_EXECUTION_REQUIRED | EXTERNAL_EXECUTION | No actual current macOS Safari environment has executed in the available GitHub tooling. WebKit-on-Linux is not relabeled as Safari. See PR #92 for subsequently captured operator-executed Safari staging evidence; that evidence remains separate until integrated. |
| iOS Safari | EXTERNAL_EXECUTION_REQUIRED | EXTERNAL_EXECUTION | No physical/current iOS Safari execution evidence is available in the connected tooling. |
| Android Chrome physical | EXTERNAL_EXECUTION_REQUIRED | EXTERNAL_EXECUTION | No physical representative Android Chrome execution evidence is available in the connected tooling. |
| Desktop Edge | EXTERNAL_EXECUTION_REQUIRED | EXTERNAL_EXECUTION | No actual Microsoft Edge branded-browser execution has been performed; Chromium engine automation is not relabeled as Edge. |
| Wallet / in-app browsers | NO_FIRST_CLASS_WALLET_BROWSER_CLAIM | NOT_CLAIMED | Bread V1 claims generic injected EIP-1193 wallet behavior only; no brand-specific wallet/in-app browser compatibility claim is made without execution evidence. |

## Automated coverage proved

The automated matrix covers Explore/Search/Token; generic injected EIP-1193 wallet connect; wrong-network to Arc Testnet switch; Buy review/submit/recovery; Sell review/submit; Create and Launch+Buy; creator claim; graduation/permanent-lock visibility; keyboard navigation and visible focus on transaction controls; reduced-motion preference; and the retained mobile keyboard-pressure trade flow.

Canonical Arc manifests are restored byte-for-byte by the browser harness and independently guarded by CI.

## Release truthfulness boundary

Automated engine/emulation PASS does not convert the physical/current-device rows to PASS. Under the frozen Day-9 plan, the remaining `EXTERNAL_EXECUTION_REQUIRED` rows prevent the overall supported-matrix release gate from being declared PASS. Task 8 therefore records `SUPPORTED_MATRIX = BLOCKED_EXTERNAL_EXECUTION_REQUIRED` until those required environments actually execute or a controlling source amendment changes the requirement.
