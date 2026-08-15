# Day 9 Browser / Device / Wallet / Accessibility Matrix

Status: **AUTOMATED ENGINE MATRIX PASS — MACOS SAFARI AND PHYSICAL ANDROID PARTIAL EVIDENCE; IOS / REMAINING ANDROID CHECKLIST / BRANDED EDGE REMAIN EXTERNAL**

This evidence distinguishes browser-engine automation and viewport emulation from actual branded-browser / physical-device execution. A Playwright WebKit run is not a macOS/iOS Safari execution claim, and mobile Chromium emulation is not a physical Android/iOS claim.

The controlling automated evidence is now the exact-head local release matrix on head `80b94dcf106b5dce2f6000dab1205405084535ac`, recorded in `docs/evidence/day9-exact-head-local-release-matrix.md`. Its Lane 6 executed all four browser projects — 76 tests, 40 passed, 36 skipped, 0 failed — after two WebKit keyboard/focus failures were repaired at their owning layer. The earlier pre-final integrated evidence was Day-9 Lane 6 run `31445491625` on head `5c0e6ce15af30f406a8c367dc906c188451406c8`, with retained Day-7 primary Playwright run `31445491601` and Day-9 recovery run `31445491591` also green on that same head. The recovery regression's deterministic fixture race was repaired without changing production recovery logic, assertions, or timeouts.

The controlling Project Source 04D requires current Chrome and Edge on desktop, current Safari on macOS, current Firefox, current plus previous-major iOS Safari where practical, current Chrome on a representative mid-range Android device, and only the wallet/in-app browser paths Bread explicitly claims to support. A wallet is not first-class until Create/Buy/Sell/Claim/network-switch have been tested with it.

| Target | Status | Evidence kind | Evidence |
| --- | --- | --- | --- |
| Desktop Chromium / Chrome | PASS | AUTOMATED_BROWSER_ENGINE | Executed retained desktop Chromium journeys, including transaction recovery, on the repaired integrated head. This is engine evidence; the current Chrome requirement still receives its strongest automated Chromium coverage here. |
| Desktop Firefox | PASS | AUTOMATED_BROWSER_ENGINE | Firefox-engine automation executed. |
| Desktop WebKit | PASS | AUTOMATED_BROWSER_ENGINE | WebKit-engine automation executed. This is not relabeled as Safari-branded physical execution. |
| Mobile Chromium emulation | PASS | EMULATION | Mobile Chromium emulation executed, including retained mobile keyboard-pressure trade coverage. This is not physical Android evidence. |
| macOS Safari | PARTIAL_PASS_EXTERNAL_USER_EXECUTION | EXTERNAL_EXECUTION | On 2026-08-11 the operator reported successful execution on actual macOS Safari against the Vercel `bread-web` staging deployment from `c21b49a1f8edaaad999e461edb0ce602071bda5c`: page/navigation/responsive sweep good; Rabby detected and connected; wrong-network state surfaced; Arc Testnet add succeeded; switch succeeded; Bread recognized the switched network. Portfolio API data was unavailable because staging API/indexer was not deployed. Buy/Sell/Create/Claim were not executed in that Safari run. The later canonical Arc Testnet Bread deployment/smoke does not retroactively turn those browser transaction paths into Safari evidence. |
| iOS Safari | EXTERNAL_EXECUTION_REQUIRED | EXTERNAL_EXECUTION | No physical/current iOS Safari execution evidence is available. Current plus previous-major iOS Safari remains required where practical by 04D. |
| Android Chrome physical | PARTIAL_PASS_EXTERNAL_USER_EXECUTION | EXTERNAL_EXECUTION | On 2026-08-13 a real physical Android Chrome path executed against the bounded LAN acceptance composition and canonical Arc Testnet stack. The existing BTST launch's threshold-crossing Buy had previously confirmed while best-effort automatic graduation failed; after the bounded browser repair was exact-head verified, the same physical device executed the permissionless recovery: `sweep` confirmed, indexed state advanced to `SWEPT`, `createPool` confirmed, final coordinator phase became `POOL_CREATED`, position `266664` was owned by the permanent locker, and coordinator/adapter token+USDC residue was zero. This is strong real-device transaction/recovery evidence, but exact Android model/OS/browser/wallet versions and the full 04D per-device checklist are not all retained/executed here, so the row remains partial rather than PASS. |
| Desktop Edge | EXTERNAL_EXECUTION_REQUIRED | EXTERNAL_EXECUTION | No actual current Microsoft Edge branded-browser execution has been performed; Chromium engine automation is not relabeled as Edge. |
| Wallet / in-app browsers | NO_FIRST_CLASS_WALLET_BROWSER_CLAIM | NOT_CLAIMED | Bread V1 claims generic injected EIP-1193 behavior only. Rabby detection/connect/network switching was observed on macOS Safari, and a physical Android wallet transaction/recovery path executed, but the full Create/Buy/Sell/Claim/network-switch matrix with one named wallet has not been retained as complete evidence, so no wallet is promoted to a first-class compatibility claim. |

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

## Physical Android Chrome transaction/graduation recovery — 2026-08-13

Execution source: operator-reported physical-device execution with retained screenshots, transaction hashes, exact-head local test/build output, and read-only Arc Testnet receipt/state/custody verification. The full incident and recovery evidence is retained in `docs/evidence/day9-physical-android-auto-graduation-recovery.md`.

Environment:

- bounded LAN acceptance composition reached `BREAD_LAN_ACCEPTANCE_READY`;
- real Bread indexer caught up and remained synchronized with Arc Testnet;
- real Bread API listened on loopback;
- production Next.js build completed;
- same-origin LAN proxy served the physical Android browser;
- canonical deployment/network files remained the authority.

Observed physical transaction/recovery path:

- existing BTST token: `0x9E9c161316FFA946E0D809Ba17345728478132f5`;
- threshold-crossing Buy transaction: `0x0fa24e607ec2d5972bec8b6c87a8c68741216526194eaaecabc1f22b89212ac3`;
- successful Buy persisted while automatic Stage-1 graduation failed, preserving INV-053;
- repaired Pending UX surfaced a permissionless retry action;
- Stage-1 `sweep` transaction: `0xbb4e1d42339aa68faaa90ae765f2f1392d7fb9dc4387a10c56049e4713e71360` — confirmed;
- indexed state advanced to `SWEPT`, and the physical UI surfaced `Continue graduation`;
- Stage-2 `createPool` transaction: `0xa87ee13b73656edd678e4c4505162bf8dd49d76baef8cda46d3b8f625f0df2e9` — receipt status `1 (success)`;
- final phase: `POOL_CREATED`;
- V3 pool: `0x9995b278d08484ff746bbe91187a723d85c093f1`;
- Position Manager: `0x444Cc395346428216fB6f2892eb03cB804aE4CD5`;
- position ID: `266664`;
- position owner: canonical permanent locker `0xecf66a3a221d90a413d9015803417aa8d4ba97fe`;
- curve `graduated() = true`;
- coordinator BTST residue: `0`;
- adapter BTST residue: `0`;
- coordinator USDC residue: `0`;
- adapter USDC residue: `0`.

This closes the demonstrated physical-Android automatic-graduation regression/recovery lane. It does **not** by itself close the complete Android row: the runbook requires device model, OS version, exact Chrome version, wallet/version, origin, and PASS/FAIL/NOT EXECUTED for every per-device step, including navigation/responsive, freshness/degraded reads, network switch, Create/Buy/Sell/Claim/reload recovery, keyboard reachability, reduced motion and TalkBack announcements. Unretained/unexecuted steps remain open rather than inferred from the successful graduation recovery.

## Automated coverage proved

The automated matrix covers, in aggregate across its four projects: Explore/Search/Token; generic injected EIP-1193 wallet connect; wrong-network to Arc Testnet switch; Buy review/submit/recovery; Sell review/submit; Create and Launch+Buy; creator claim; graduation/permanent-lock visibility; keyboard navigation and visible focus on transaction controls; reduced-motion preference; and the retained mobile keyboard-pressure trade flow.

That aggregate is not uniform per engine, and is not claimed to be. Under the retained Day-7 task-ownership gating, Create, Claim, Sell and the transaction-recovery journeys execute on `desktop-chromium`, and the mobile keyboard-pressure trade flow executes on `mobile-chromium`. The Firefox and WebKit engine projects execute browse/Explore/Search with keyboard containment and Escape focus restoration, degraded and graduated read truthfulness, the deterministic fixture boundary, the keyboard-reachability/visible-focus/reduced-motion proof, and the alternate-engine wallet Buy smoke (connect, review, submit, `CONFIRMED`, single submitted transaction, no unknown RPC calls).

WebKit's sequential-focus probe presses Safari's native `Option`/`Alt`+`Tab` convention rather than plain `Tab`, because Safari does not include buttons in plain-`Tab` traversal by default. The underlying accessibility assertions are identical to the other engines: the control must be reached by keyboard, must become `document.activeElement`, and must expose a visible focus outline of positive width. A direct probe confirmed the control is `tabIndex=0`, not disabled, not `aria-hidden`, focusable, and rings at solid 2px in WebKit.

Canonical Arc manifests are restored byte-for-byte by the browser harness and independently guarded by repository checks.

## Release truthfulness boundary

Until Day-9 Gap-1 and Gap-2, the physical rows were classified `EXTERNAL_EXECUTION_REQUIRED` while two implementation prerequisites were in fact missing: ordinary iOS Safari and Android Chrome had no reachable wallet path under an `injected()`-only configuration, and the repository had no executable runtime able to serve the web app and the indexed API on one origin. That classification was therefore partly premature. Both prerequisites are now repaired, so the remaining physical rows are genuinely external execution requirements.

Automated engine/emulation PASS plus the partial physical macOS Safari and physical Android executions do not convert the remaining physical/current-device rows to PASS. Under 04D and the frozen Day-9 plan, current branded Edge, required iOS Safari coverage, the remaining full physical representative Android Chrome checklist, and the incomplete Safari transaction-path coverage remain external execution requirements. The overall supported matrix therefore remains `BLOCKED_EXTERNAL_EXECUTION_REQUIRED` until those required environments actually execute or a controlling Project Source amendment changes the matrix.

No wallet brand is advertised as first-class on the basis of partial device evidence.