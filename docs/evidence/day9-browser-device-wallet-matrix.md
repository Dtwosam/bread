# Day 9 Browser / Device / Wallet / Accessibility Matrix

Status: **AUTOMATED ENGINE MATRIX PASS — MACOS SAFARI PARTIAL PHYSICAL EVIDENCE; IOS / PHYSICAL ANDROID / BRANDED EDGE REMAIN EXTERNAL**

This evidence distinguishes browser-engine automation and viewport emulation from actual branded-browser / physical-device execution. A Playwright WebKit run is not a macOS/iOS Safari execution claim, and mobile Chromium emulation is not a physical Android/iOS claim.

The controlling automated evidence is now the exact-head local release matrix on head `57d1dc9f63ed4ba61e7dc1d16eb41d1c29fb3b71`, recorded in `docs/evidence/day9-exact-head-local-release-matrix.md`. Its Lane 6 executed all four browser projects — 76 tests, 40 passed, 36 skipped, 0 failed — after two WebKit keyboard/focus failures were repaired at their owning layer. The earlier pre-final integrated evidence was Day-9 Lane 6 run `31445491625` on head `5c0e6ce15af30f406a8c367dc906c188451406c8`, with retained Day-7 primary Playwright run `31445491601` and Day-9 recovery run `31445491591` also green on that same head. The recovery regression's deterministic fixture race was repaired without changing production recovery logic, assertions, or timeouts.

The controlling Project Source 04D requires current Chrome and Edge on desktop, current Safari on macOS, current Firefox, current plus previous-major iOS Safari where practical, current Chrome on a representative mid-range Android device, and only the wallet/in-app browser paths Bread explicitly claims to support. A wallet is not first-class until Create/Buy/Sell/Claim/network-switch have been tested with it.

| Target | Status | Evidence kind | Evidence |
| --- | --- | --- | --- |
| Desktop Chromium / Chrome | PASS | AUTOMATED_BROWSER_ENGINE | Executed retained desktop Chromium journeys, including transaction recovery, on the repaired integrated head. This is engine evidence; the current Chrome requirement still receives its strongest automated Chromium coverage here. |
| Desktop Firefox | PASS | AUTOMATED_BROWSER_ENGINE | Firefox-engine automation executed. |
| Desktop WebKit | PASS | AUTOMATED_BROWSER_ENGINE | WebKit-engine automation executed. This is not relabeled as Safari-branded physical execution. |
| Mobile Chromium emulation | PASS | EMULATION | Mobile Chromium emulation executed, including retained mobile keyboard-pressure trade coverage. This is not physical Android evidence. |
| macOS Safari | PARTIAL_PASS_EXTERNAL_USER_EXECUTION | EXTERNAL_EXECUTION | On 2026-08-11 the operator reported successful execution on actual macOS Safari against the Vercel `bread-web` staging deployment from `c21b49a1f8edaaad999e461edb0ce602071bda5c`: page/navigation/responsive sweep good; Rabby detected and connected; wrong-network state surfaced; Arc Testnet add succeeded; switch succeeded; Bread recognized the switched network. Portfolio API data was unavailable because staging API/indexer was not deployed. Buy/Sell/Create/Claim were not executed in that Safari run. The later canonical Arc Testnet Bread deployment/smoke does not retroactively turn those browser transaction paths into Safari evidence. |
| iOS Safari | EXTERNAL_EXECUTION_REQUIRED | EXTERNAL_EXECUTION | No physical/current iOS Safari execution evidence is available. Current plus previous-major iOS Safari remains required where practical by 04D. |
| Android Chrome physical | EXTERNAL_EXECUTION_REQUIRED | EXTERNAL_EXECUTION | No physical representative mid-range Android Chrome execution evidence is available. |
| Desktop Edge | EXTERNAL_EXECUTION_REQUIRED | EXTERNAL_EXECUTION | No actual current Microsoft Edge branded-browser execution has been performed; Chromium engine automation is not relabeled as Edge. |
| Wallet / in-app browsers | NO_FIRST_CLASS_WALLET_BROWSER_CLAIM | NOT_CLAIMED | Bread V1 claims generic injected EIP-1193 behavior only. Rabby detection/connect/network switching was observed on macOS Safari, but Create/Buy/Sell/Claim were not all executed with Rabby, so Rabby is not promoted to a first-class compatibility claim. |

## Physical macOS Safari execution — 2026-08-11

Execution source: operator-reported external physical-browser execution. It is not represented as independently observed by GitHub or automated browser tooling.

Staging target: Vercel project `bread-web`, deployed from repository commit `c21b49a1f8edaaad999e461edb0ce602071bda5c`.

Reported results:

- Home / Explore / Create / Portfolio / Creator navigation and visual sweep: good; no reported blank pages, crashes, overlap, broken navigation, or unexpected horizontal scrolling while resizing Safari.
- Wallet chooser surfaced generic `Injected` plus detected `Rabby Wallet`, with the existing truthfulness notice that detection is not compatibility certification.
- Rabby wallet detection and connection: PASS for this execution.
- Connected-wallet state reflection in Bread: PASS for this execution.
- Wrong-network detection and `Switch to Arc` prompt: PASS for this execution.
- Arc Testnet add-to-wallet flow: PASS for this execution.
- Switch to Arc Testnet and post-switch Bread state recognition: PASS for this execution.
- Portfolio indexed-data retrieval: NOT PASSED / NOT ATTRIBUTED TO SAFARI. The staging frontend called same-origin Bread API routes while the staging API/indexer was not deployed, so `Portfolio unavailable` was observed and classified as an environment/backend limitation rather than a Safari rendering/connectivity failure.
- Buy / Sell / Create / Claim transaction execution: NOT EXECUTED / NOT CLAIMED in this physical Safari run.

Since that run, the canonical Day-9 Arc Testnet Bread stack and its public launch/buy/graduation/permanent-lock/creator-claim smoke have been independently verified. That clears the protocol-environment prerequisite, but it does **not** retroactively prove browser-specific transaction paths. A future Safari transaction-path execution may now use the canonical testnet environment, but no such physical-browser execution is claimed here yet.

## Automated coverage proved

The automated matrix covers, in aggregate across its four projects: Explore/Search/Token; generic injected EIP-1193 wallet connect; wrong-network to Arc Testnet switch; Buy review/submit/recovery; Sell review/submit; Create and Launch+Buy; creator claim; graduation/permanent-lock visibility; keyboard navigation and visible focus on transaction controls; reduced-motion preference; and the retained mobile keyboard-pressure trade flow.

That aggregate is not uniform per engine, and is not claimed to be. Under the retained Day-7 task-ownership gating, Create, Claim, Sell and the transaction-recovery journeys execute on `desktop-chromium`, and the mobile keyboard-pressure trade flow executes on `mobile-chromium`. The Firefox and WebKit engine projects execute browse/Explore/Search with keyboard containment and Escape focus restoration, degraded and graduated read truthfulness, the deterministic fixture boundary, the keyboard-reachability/visible-focus/reduced-motion proof, and the alternate-engine wallet Buy smoke (connect, review, submit, `CONFIRMED`, single submitted transaction, no unknown RPC calls).

WebKit's sequential-focus probe presses Safari's native `Option`/`Alt`+`Tab` convention rather than plain `Tab`, because Safari does not include buttons in plain-`Tab` traversal by default. The underlying accessibility assertions are identical to the other engines: the control must be reached by keyboard, must become `document.activeElement`, and must expose a visible focus outline of positive width. A direct probe confirmed the control is `tabIndex=0`, not disabled, not `aria-hidden`, focusable, and rings at solid 2px in WebKit.

Canonical Arc manifests are restored byte-for-byte by the browser harness and independently guarded by repository checks.

## Release truthfulness boundary

Automated engine/emulation PASS plus the partial physical macOS Safari execution does not convert the remaining physical/current-device rows to PASS. Under 04D and the frozen Day-9 plan, current branded Edge, required iOS Safari coverage, and physical representative Android Chrome remain external execution requirements. The overall supported matrix therefore remains `BLOCKED_EXTERNAL_EXECUTION_REQUIRED` until those required environments actually execute or a controlling Project Source amendment changes the matrix.

No wallet brand is advertised as first-class on the basis of detection/connect-only evidence.
