# Day 9 Browser / Device / Wallet / Accessibility Matrix

Status: **AUTOMATED MATRIX EXECUTED — FINAL EXACT-HEAD GREEN RERUN REQUIRED**

This evidence distinguishes browser-engine automation and viewport emulation from actual branded-browser / physical-device execution. A Playwright WebKit run is not a macOS/iOS Safari execution claim, and mobile Chromium emulation is not a physical Android/iOS claim.

The promotion below is grounded in Day-9 Lane 6 run `31443189578` on precursor candidate head `00a9446b6b6879a36afc1d1b55748bc11632a17d`. That run executed the four automated projects and reported 39 passed / 36 intentionally skipped; its sole test failure was this evidence file still carrying `PENDING_AUTOMATED_EXECUTION`. The canonical Arc manifest-restoration guard passed. This evidence-only promotion must now be re-proved by a final exact-head GREEN rerun before Task 6 is accepted.

| Target | Status | Evidence kind | Evidence |
| --- | --- | --- | --- |
| Desktop Chromium | PASS | AUTOMATED_BROWSER_ENGINE | Day-9 Lane 6 run `31443189578` executed the retained desktop Chromium matrix; final exact-head GREEN rerun required after this evidence promotion. |
| Desktop Firefox | PASS | AUTOMATED_BROWSER_ENGINE | Day-9 Lane 6 run `31443189578` executed the Firefox-engine matrix; this is an engine-automation claim only; final exact-head GREEN rerun required. |
| Desktop WebKit | PASS | AUTOMATED_BROWSER_ENGINE | Day-9 Lane 6 run `31443189578` executed the WebKit-engine matrix; this is not a Safari-branded claim; final exact-head GREEN rerun required. |
| Mobile Chromium emulation | PASS | EMULATION | Day-9 Lane 6 run `31443189578` executed mobile Chromium emulation including retained mobile keyboard-pressure coverage; this is not a physical-device claim; final exact-head GREEN rerun required. |
| macOS Safari | EXTERNAL_EXECUTION_REQUIRED | EXTERNAL_EXECUTION | No actual current macOS Safari environment has executed in the available GitHub tooling. WebKit-on-Linux is not relabeled as Safari. |
| iOS Safari | EXTERNAL_EXECUTION_REQUIRED | EXTERNAL_EXECUTION | No physical/current iOS Safari execution evidence is available in the connected tooling. |
| Android Chrome physical | EXTERNAL_EXECUTION_REQUIRED | EXTERNAL_EXECUTION | No physical representative Android Chrome execution evidence is available in the connected tooling. |
| Desktop Edge | EXTERNAL_EXECUTION_REQUIRED | EXTERNAL_EXECUTION | No actual Microsoft Edge branded-browser execution has been performed; Chromium engine automation is not relabeled as Edge. |
| Wallet / in-app browsers | NO_FIRST_CLASS_WALLET_BROWSER_CLAIM | NOT_CLAIMED | Bread V1 claims generic injected EIP-1193 wallet behavior only; no brand-specific wallet/in-app browser compatibility claim is made without execution evidence. |

## Automated coverage required before Task-6 acceptance

The final Day-9 Lane 6 exact-head Playwright rerun must execute the retained deterministic Bread fixtures and cover Explore/Search/Token; generic injected EIP-1193 wallet connect; wrong-network to Arc Testnet switch; Buy review/submit/recovery; Sell review/submit; Create and Launch+Buy; creator claim; graduation/permanent-lock visibility; keyboard navigation and visible focus on transaction controls; reduced-motion preference; and the retained mobile keyboard-pressure trade flow.

Task 6 is not accepted merely because the four automated rows are now recorded as `PASS`. The promotion is valid only if the new exact-head Lane 6 workflow is GREEN and the canonical Arc manifests are restored byte-for-byte. Physical/branded-device rows remain external until actual evidence exists.
