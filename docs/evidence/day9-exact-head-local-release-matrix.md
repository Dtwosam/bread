# Day 9 Exact-Head Local Release Matrix — WebKit Accessibility Repair Closeout

Status: **DAY9_EXACT_HEAD_LOCAL_RELEASE_MATRIX_PASS — EXTERNAL CI AND PHYSICAL/BRANDED DEVICE ROWS REMAIN OPEN**

Durable `main` at verification time: `c21b49a1f8edaaad999e461edb0ce602071bda5c`
Candidate PR: #93 (open, draft, unmerged)

The matrix has been rerun and passed at each subsequent head. The WebKit sections below were verified at code head `57d1dc9f63ed4ba61e7dc1d16eb41d1c29fb3b71`; the Gap-1 and Gap-2 sections appended at the end were verified at `80b94dcf106b5dce2f6000dab1205405084535ac`. No earlier-head result is relied upon for a later head.

This evidence records the complete Day-9 exact-head local release matrix executed against the exact candidate head, plus the systematic debugging that closed the two WebKit keyboard/focus failures which previously stopped Lane 6. It does **not** declare Day-9 PASS, RC readiness, public-money readiness, or Day-10 start.

## Failures repaired

The prior Lane-6 run reached WebKit and failed exactly two keyboard/focus assertions. All other WebKit coverage — including the alternate-engine wallet Buy smoke — continued to execute before and after those failures.

### Failure A — Search dialog focus restoration (WebKit)

Spec: `apps/web/e2e/specs/browse-search.spec.ts` — *Explore filters and Search preserve contract identity plus keyboard containment*.

After closing the Search dialog with `Escape`, WebKit did not restore focus to the Search trigger; `searchTrigger` was expected focused, actual was inactive.

Root cause: `SearchSurface.openSearch()` captured the return-focus target from `document.activeElement`. Safari/WebKit does not move focus to a `<button>` on mouse activation the way Chromium and Firefox do, so at handler time `document.activeElement` was not the Search button and the return-focus reference was stored as `null`. The dialog then had no element to restore focus to. The button itself was never unfocusable — only the *capture* was engine-dependent.

Repair (`apps/web/components/search-surface.tsx`): capture the actual activating control from the click event's `currentTarget` instead of ambient document focus. `currentTarget` is read synchronously inside the handler and only the resolved DOM node is retained, which is valid under React 17+ event semantics. The fix is engine-independent — it does not branch on browser — and it makes the previously implicit assumption explicit.

Supporting repair (`packages/ui/src/button.ts`): the shared `Button` already forwarded `onClick` straight to the DOM button, but its prop type erased the argument (`() => void`), so no consumer could observe the activation target. The type is now `(event: MouseEvent<HTMLButtonElement>) => void`. This is a type-only widening: no runtime behavior, markup, class names, ARIA attributes, or disabled/loading semantics changed, and existing zero-argument handlers remain assignable.

### Failure B — sequential keyboard focus in WebKit

Spec: `apps/web/e2e/specs/day9-release-matrix.spec.ts` — *primary trade controls are keyboard reachable with visible focus and reduced motion is honored*.

Chromium and Firefox reached `Connect wallet` with plain `Tab`; WebKit did not.

Root cause: Safari/WebKit's default sequential-focus convention. With "tabs to links / full keyboard access" off, plain `Tab` visits form fields only, while `Option`/`Alt`+`Tab` visits all clickable items. This is browser convention, not a Bread defect.

A direct diagnostic probe against the same page confirmed the control is genuinely accessible in WebKit and that only the traversal key differs:

| Project | `disabled` | `tabIndex` | `aria-hidden` | focusable via API | focus ring | plain `Tab` reaches | `Alt+Tab` reaches |
| --- | --- | --- | --- | --- | --- | --- | --- |
| desktop-chromium | false | 0 | none | true | solid 2px | true | true |
| probe-webkit | false | 0 | none | true | solid 2px | **false** | **true** |

Repair (`apps/web/e2e/specs/day9-release-matrix.spec.ts`): the WebKit probe presses Safari's native sequential-focus shortcut; every other project still presses plain `Tab`. The accessibility assertions are unchanged — the control must still be reached by keyboard, must still be `document.activeElement`, must still expose a non-`none` outline of positive width, and reduced motion must still be honored. No WebKit test is skipped, no assertion was deleted or weakened, and no timeout was raised.

## RED/GREEN verification of the repairs

Both repairs were confirmed load-bearing rather than incidentally green.

- Reverting `openSearch()` to the pre-repair `document.activeElement` capture reproduced Failure A on `probe-webkit` (1 failed, 1 passed) with trace, screenshot and video artifacts. Restoring the committed repair returned the spec to green. The temporary revert and the temporary diagnostic spec were removed; the working tree is clean at the verified head.
- The Failure B diagnostic above shows the control's focusability and focus ring are real in WebKit independent of the traversal key, so the assertion still proves the 04D property it claims to prove.

## Focused verification before the full matrix

| Check | Command | Result |
| --- | --- | --- |
| Root TypeScript project build | `pnpm typecheck` (`tsc -b`) | PASS |
| Web app typecheck (covers the changed `.tsx`) | `pnpm exec tsc --noEmit -p apps/web/tsconfig.json` | PASS |
| Focused WebKit | `playwright test --config=e2e/playwright.day9-release.config.ts --project=probe-webkit browse-search.spec.ts day9-release-matrix.spec.ts` | 3 passed, 1 skipped |
| Chromium counterpart | same, `--project=desktop-chromium` | 4 passed |
| Firefox counterpart | same, `--project=probe-firefox` | 3 passed, 1 skipped |

The canonical Arc manifest was swapped to the browser fixture and restored byte-for-byte for each focused run, verified by `git diff --exit-code` on `config/deployments/arc-testnet.day5.json` and `config/networks/arc-testnet.json`.

## Exact-head local release matrix

The local matrix was repinned to the actual current head before execution, so the run verifies the exact commit under consideration.

```text
HEAD=57d1dc9f63ed4ba61e7dc1d16eb41d1c29fb3b71
DAY9_EXACT_HEAD_LOCAL_RELEASE_MATRIX_PASS
VERIFIED_HEAD=57d1dc9f63ed4ba61e7dc1d16eb41d1c29fb3b71
GITHUB_ACTIONS_STATUS=SEPARATE_EXTERNAL_STARTUP_FAILURE
SUPPORTED_PHYSICAL_MATRIX=STILL_BLOCKED_EXTERNAL_EXECUTION_REQUIRED
```

Lanes executed and passed, in order:

- exact-head assertion plus clean working tree;
- frozen-lockfile install and pinned Playwright browser install;
- static manifest/build-gate/build-state/source-integrity validators and Day-6 read-stack validation;
- bootstrap tests and bootstrap smoke;
- `pnpm validate`, `pnpm test`, `pnpm test:day6`, shared-contract type check;
- `pnpm typecheck` and `pnpm build`, with a clean working tree afterwards;
- `forge build`, `bread-abi-check: PASS`, and the ordinary Foundry regression with `--no-match-path 'test/fork/**'` isolation intact;
- Day-9 Lane 1 Arc environment identity, including live read-only Arc Testnet confirmation of chainId `5042002` and canonical 6-decimal USDC at `0x3600000000000000000000000000000000000000`;
- Day-9 Lane 2 rehearsal readiness and Lane 3 clean controlled local rehearsal;
- retained Day-8 failure injection, hot-launch cache budget and sustained-arrival indexer catch-up;
- root infrastructure integration and retained Day-8 failure/recovery integration on real Postgres/Redis;
- Day-9 Lane 4 service rollback;
- Day-9 Lane 5 browser recovery drill — `DAY9_BROWSER_RECOVERY_DRILL_PASS commit=57d1dc9f63ed4ba61e7dc1d16eb41d1c29fb3b71` — plus the complete recovery drill bundle;
- Day-9 Lane 6 automated browser release matrix — **76 tests, 40 passed, 36 skipped, 0 failed**;
- Day-9 Lane 7 verified live Arc repository gate — `"authorized": true`, `"blockers": []`;
- final truthfulness assertions, including confirmation that no `bread-day9-rc1` tag exists.

### Lane 6 per-engine scope — stated precisely

All four projects executed. The 36 skips are pre-existing Day-7 task-ownership gates, not new suppressions, and they reconcile exactly: `desktop-chromium` 16 passed / 3 skipped, `probe-firefox` 8/11, `probe-webkit` 8/11, `mobile-chromium` 8/11.

WebKit-engine coverage on this head therefore comprises browse/Explore/Search with keyboard containment and Escape focus restoration, degraded and graduated read truthfulness, the deterministic fixture boundary, the keyboard-reachability/visible-focus/reduced-motion proof, and the alternate-engine wallet Buy smoke (connect, review, submit, `CONFIRMED`, single submitted transaction, no unknown RPC calls).

Create, Claim, Sell and the transaction-recovery journeys remain owned by `desktop-chromium`, and the mobile keyboard-pressure trade flow remains owned by `mobile-chromium`. WebKit engine execution is **not** a macOS or iOS Safari claim, and mobile Chromium emulation is **not** a physical Android claim.

## External CI — truthful classification

Not executed. Not green. Not a code or test failure.

Both workflow runs at exactly `57d1dc9f63ed4ba61e7dc1d16eb41d1c29fb3b71` concluded `startup_failure`:

| Run | Event | Conclusion | Jobs created |
| --- | --- | --- | --- |
| `31512708748` | `pull_request` | `startup_failure` | 0 |
| `31512701643` | `push` | `startup_failure` | 0 |

Both report `path: "BuildFailed"`, `name: ""`, `display_title: "(Unknown event)"`, and the commit has **zero** check runs, so no job-level log or annotation exists to repair from. The same pattern holds for every recent candidate commit (`8ff1e266`, `1f02b008`, `4c2298ca`).

Local investigation found no defect to fix at this head: all 34 workflow files under `.github/workflows` parse as valid YAML with exactly one top-level `name:`, one `on:` trigger and a `jobs:` mapping; no tab indentation is present; repository Actions are `enabled: true` with `allowed_actions: "all"`; and the repository is neither archived nor disabled. The failing runs are attributed to a synthetic workflow record (`path: "BuildFailed"`, `state: "deleted"`) rather than to any tracked workflow file, which is GitHub's representation of a failure to build the workflow set before job creation. Account-level Actions billing/entitlement could not be inspected with the available token scopes (`gist`, `read:org`, `repo`, `workflow`).

This surface is recorded as unavailable/startup-failed. It is **not** recorded as executed CI of any colour, and the passing local matrix does not substitute for it.

## What was deliberately not rerun

No already-proven chain operation was repeated. Specifically preserved without re-execution:

- the canonical Arc Testnet Bread deployment from source commit `db0f6ed28e4a2475f54e84efadd7cf9693701353`, start block `56448201`, manifest `VERIFIED`;
- the public Arc Testnet lifecycle smoke — token `0x9dc6c650929b641f93269a3b6d7d5237297d938b`, curve `0x68db37eea822d42af898b9777a96bef022a0e36d`, locked LP position `265870` owned by `0xecf66a3a221d90a413d9015803417aa8d4ba97fe`;
- the real 2-of-3 Safe threshold recovery drill, nonce `0 -> 2`, original owner set restored;
- the real Arc dependency fork proof at block `56439192`, which stays excluded from ordinary Foundry regression by the retained `test/fork/**` isolation.

No Bread stack was redeployed, no second smoke token or trade was created, no Safe rotation was performed, and no signing material was read, printed or requested. Lane 1's Arc Testnet contact is read-only (`cast chain-id`, `cast code`, `cast call decimals()`).

## Financial and architectural invariants

Unchanged. The repairs touch a browser focus-capture path, a shared UI prop type, and one test's keyboard traversal key. No protocol, economics, deployment, Safe, indexer, API, custody or signing logic was modified. Chain remains the financial source of truth; DB/indexer/API/Redis remain projections; graduation remains DEX-neutral through `IGraduationAdapter`; Synthra remains Arc-Testnet provider provenance only; Arc mainnet DEX selection, the Arc mainnet manifest and production economics all remain unresolved and independently gated.

## Remaining Day-9 blockers

- `PHYSICAL_DEVICE_EXTERNAL_EXECUTION_REQUIRED` — physical iOS Safari, representative physical Android Chrome, and current branded Microsoft Edge. macOS Safari holds bounded `PARTIAL_PASS_EXTERNAL_USER_EXECUTION` evidence only; a full `PASS` still requires `PHYSICAL_EXECUTION` covering the browser transaction matrix.
- `DAY9_EXACT_HEAD_RELEASE_CI_REQUIRED` — the local exact-head matrix now passes, but external GitHub Actions has not executed at this head.

PR #93 remains draft and unmerged. No RC tag is authorized and Day 10 remains stopped.

---

# Day-9 implementation prerequisites — Gap 1 and Gap 2

The physical rows were previously classified `EXTERNAL_EXECUTION_REQUIRED`. That was partly premature: two implementation prerequisites were missing, so the physical browsers could not have executed the source-required journeys even with a willing operator and device.

## Gap 1 — mobile wallet connectivity (repaired)

`apps/web/lib/wallet/config.ts` shipped `connectors: [injected()]`, which can only reach a wallet through EIP-6963/EIP-1193 injection. Chrome for Android supports no extensions at all, and no mainstream EVM wallet ships an iOS Safari extension, so neither mandatory 04D mobile target could ever be presented with a wallet. Desktop Edge was unaffected because Chromium extensions load there.

Every Playwright fixture injects a synthetic `window.ethereum`, so the automated matrix proved Bread's transaction logic *given* a provider and never proved provider availability on a real device.

Repaired by adding wagmi's `walletConnect()` connector alongside `injected()` — the provider-neutral remote path named by 04C. The runtime already iterates `useConnectors()`, so no transaction, recovery or network-switch logic changed. Exactly one dependency, `@walletconnect/ethereum-provider`, lazily imported at connect time and absent from every build manifest. The project id is a public client identifier read from `NEXT_PUBLIC_BREAD_WALLETCONNECT_PROJECT_ID`; absent configuration fails closed to injected-only. Signing remains entirely user-side.

## Gap 2 — executable LAN runtime composition (repaired)

No `.listen()` existed anywhere in the repository. `createBreadApi()` and `runIndexerCli()` were only ever called from tests, neither app had a start script or bin, `apps/web` had no `/v1` route handlers, and the infra compose provided only Postgres and Redis. There was therefore no way to serve the web app and the indexed API on one origin — which is why the earlier macOS Safari run reported `Portfolio unavailable`.

Repaired with an operator-only composition: real indexer, real read API, production Next.js build, and one bounded same-origin LAN entrypoint. Every piece is a shell around existing Day-6 code; no second API or indexing model exists.

### Canonical stack identity derivation

The verified deployment manifest carries no `stackVersion`, yet API and indexer checkpoints key on it. Rather than mutating deployment truth or inventing a value, the runtime derives it from the existing canonical label:

```text
stackVersion = keccak256("BREAD_DAY9_ARC_TESTNET_STACK_V1")
             = 0xc862a0ec7e5eb592f1a77b4971552b79f65528b1f1addf97fdfc42b8f774e063
```

Recomputing the deployment economics hash from that derivation reproduces the manifest's recorded `economicsConfigHash` exactly:

```text
recomputed = 0x081b597d7b603cb67d3921f269f7940a84221524b2d9baefc4f319c9f15f9747
recorded   = 0x081b597d7b603cb67d3921f269f7940a84221524b2d9baefc4f319c9f15f9747
```

This proves the derived identity is the identity the deployed stack was configured with.

### Verified by real execution

- API process listened and served canonical `/v1/status`: `503 INDEXER_NOT_READY` before catch-up, then `200` carrying real freshness metadata with a truthful `LAGGING` status, correct factory, deployment start block and derived stack version.
- One real indexer cycle against Arc Testnet advanced the committed checkpoint `56448201 -> 56448501` against observed head `56487382`.
- The bounded proxy served that real API at `/v1/*` and the web app at all other paths on a single origin.
- Real execution also caught and fixed a seed defect where the genesis checkpoint preceded the deployment-start lower bound.

### Security boundary

Routing is decided solely by path against two pinned loopback upstreams, so a forged `Host` header cannot redirect traffic and the proxy can never act as an open proxy. Absolute-form request targets are rejected, `/v1` traversal is contained by normalized-path comparison, and hop-by-hop headers are stripped. Only the bounded proxy binds the LAN interface; Postgres, Redis, the API and the web app remain loopback-only, and the API refuses a non-loopback bind. No signing material is loaded by any process and the chain client is read-only with no account attached.

## Consequence

With both prerequisites repaired, the remaining physical rows — iOS Safari, representative physical Android Chrome, and current branded Microsoft Edge — are now genuinely external execution requirements. They remain open, and no wallet brand is promoted to first-class on the basis of this work.
