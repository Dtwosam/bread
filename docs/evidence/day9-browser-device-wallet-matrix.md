# Day 9 Browser / Device / Wallet / Accessibility Matrix

Status: **PENDING AUTOMATED EXECUTION**

This evidence distinguishes browser-engine automation and viewport emulation from actual branded-browser / physical-device execution. A Playwright WebKit run is not a macOS/iOS Safari execution claim, and mobile Chromium emulation is not a physical Android/iOS claim.

| Target | Status | Evidence kind | Evidence |
| --- | --- | --- | --- |
| Desktop Chromium | PENDING_AUTOMATED_EXECUTION | AUTOMATED_BROWSER_ENGINE | Day-9 Lane 6 exact-head Playwright desktop Chromium matrix pending. |
| Desktop Firefox | PENDING_AUTOMATED_EXECUTION | AUTOMATED_BROWSER_ENGINE | Day-9 Lane 6 exact-head Playwright Firefox-engine matrix pending. |
| Desktop WebKit | PENDING_AUTOMATED_EXECUTION | AUTOMATED_BROWSER_ENGINE | Day-9 Lane 6 exact-head Playwright WebKit-engine matrix pending; this is not a Safari-branded claim. |
| Mobile Chromium emulation | PENDING_AUTOMATED_EXECUTION | EMULATION | Day-9 Lane 6 exact-head mobile Chromium emulation pending; includes retained keyboard-pressure trade flow. |
| macOS Safari | EXTERNAL_EXECUTION_REQUIRED | EXTERNAL_EXECUTION | No actual current macOS Safari environment has executed in the available GitHub tooling. WebKit-on-Linux is not relabeled as Safari. |
| iOS Safari | EXTERNAL_EXECUTION_REQUIRED | EXTERNAL_EXECUTION | No physical/current iOS Safari execution evidence is available in the connected tooling. |
| Android Chrome physical | EXTERNAL_EXECUTION_REQUIRED | EXTERNAL_EXECUTION | No physical representative Android Chrome execution evidence is available in the connected tooling. |
| Desktop Edge | EXTERNAL_EXECUTION_REQUIRED | EXTERNAL_EXECUTION | No actual Microsoft Edge branded-browser execution has been performed; Chromium engine automation is not relabeled as Edge. |
| Wallet / in-app browsers | NO_FIRST_CLASS_WALLET_BROWSER_CLAIM | NOT_CLAIMED | Bread V1 claims generic injected EIP-1193 wallet behavior only; no brand-specific wallet/in-app browser compatibility claim is made without execution evidence. |

## Automated coverage required before promotion to PASS

The Day-9 Lane 6 Playwright matrix must execute the retained deterministic Bread fixtures and cover Explore/Search/Token; generic EIP-1193 wallet connect; wrong-network to Arc Testnet switch; Buy review/submit/recovery; Sell review/submit; Create and Launch+Buy; creator claim; graduation/permanent-lock visibility; keyboard navigation and visible focus on transaction controls; reduced-motion preference; and the retained mobile keyboard-pressure trade flow.

The four automated rows above may be changed to `PASS` only after the Lane 6 workflow executes successfully on the exact candidate head and the canonical Arc manifests are restored byte-for-byte. Physical/branded-device rows remain external until actual evidence exists.
