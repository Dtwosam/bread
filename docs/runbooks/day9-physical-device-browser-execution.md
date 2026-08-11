# Day 9 — Physical / Branded Browser Execution Runbook

Purpose: close the three remaining 04D Browser / Device Release Matrix rows that Playwright cannot satisfy.

| Row | Current status | What closes it |
| --- | --- | --- |
| iOS Safari | `EXTERNAL_EXECUTION_REQUIRED` | Physical iPhone, current iOS Safari (previous-major additionally where practical) |
| Android Chrome physical | `EXTERNAL_EXECUTION_REQUIRED` | Physical representative mid-range Android device, current Chrome |
| Desktop Edge | `EXTERNAL_EXECUTION_REQUIRED` | Current branded Microsoft Edge on desktop |

Playwright WebKit is **not** iOS/macOS Safari evidence. Mobile Chromium emulation is **not** physical Android evidence. Chromium engine automation is **not** Edge evidence. Do not relabel any of them.

macOS Safari already holds `PARTIAL_PASS_EXTERNAL_USER_EXECUTION`. It is not upgraded to `PASS` until a physical Safari run covers the browser transaction matrix below.

---

## Environment — bounded LAN acceptance composition

Two implementation prerequisites previously blocked physical execution and are now repaired:

1. **Mobile wallet connectivity.** `injected()`-only could never present a wallet on ordinary iOS Safari or Android Chrome. A WalletConnect connector now ships alongside `injected()`.
2. **Executable runtime.** The repository had no `.listen()` anywhere, so the real API/indexer could not be launched and no single-origin composition existed — which is exactly why the earlier macOS Safari run reported `Portfolio unavailable`. An operator-only LAN composition now exists.

### Start

```bash
export NEXT_PUBLIC_BREAD_WALLETCONNECT_PROJECT_ID=<your Reown project id>
node scripts/day9/lan/run-lan-acceptance.mjs
```

The script brings up Postgres and Redis, migrates the schema, catches the **real** Bread indexer up against Arc Testnet from the verified deployment start block, starts the **real** Bread read API on loopback, builds and starts the production Next.js app on loopback, and exposes one LAN origin that serves the web app and proxies `/v1/*` to the real API. It prints:

```text
BREAD_LAN_ACCEPTANCE_READY
  LAN origin for physical devices: http://<lan-ip>:4000
```

Point every physical device at that origin. Postgres, Redis, the API and the web app remain loopback-only; only the bounded proxy listens on the LAN.

The startup gate fails closed unless Postgres and Redis are healthy, migrations are applied, the canonical context resolves, the indexer checkpoint reconciles against the chain, `/v1/status` returns a real indexed response through **both** loopback and the LAN origin, Explore loads through the LAN origin, browser fixture mode is off, and the canonical deployment/network files are byte-for-byte unchanged.

### Reown project id

Required only for the browser acceptance run, because WalletConnect will not dial without it. It is a **public client identifier**, not a secret. Obtain it from `dashboard.reown.com`, allowlist the LAN origin there, and export it as shown above. Without it the app degrades to injected-only, which cannot serve the mobile rows.

### Stop

Press `Ctrl-C`. Teardown terminates the web, API, indexer and proxy processes, stops the local infrastructure, and leaves no LAN listener behind.

Recording a row as PASS while the indexed API was unreachable is not permitted — that is the environment limitation already documented for the macOS Safari run, not a browser result.

## Chain environment — use only what already exists

Arc Testnet only. Do not deploy any contract and do not run the protocol lifecycle smoke script.

- chainId `5042002`
- USDC `0x3600000000000000000000000000000000000000`, 6 decimals
- Canonical Bread stack from `config/deployments/arc-testnet.day5.json` (status `VERIFIED`), Launch Factory `0xddf400f7a376fb8a962eee6d74c1ba37efa644f7`

Each tester needs a wallet holding Arc Testnet faucet USDC and a small gas balance. Never share, paste, export or transcribe a private key, seed phrase or any other signing material — including into this repository, a PR, or a chat.

### Note on the token used for Buy/Sell

The retained smoke token `0x9dc6c650929b641f93269a3b6d7d5237297d938b` has already graduated, so its curve is closed and it cannot satisfy a Buy/Sell test.

04D requires Create among the physical flows, so a physical run creates a testnet token by definition. Use that freshly created token for the subsequent Buy/Sell/Claim steps. This is a user-level product flow executed against the already-deployed canonical factory — it is **not** a second Bread deployment and **not** a rerun of the protocol lifecycle smoke. Nothing new is deployed.

---

## Per-device checklist

Execute every step on each target device. Record PASS / FAIL / NOT EXECUTED per step — never infer a step from another device.

### A. Shell, navigation and responsive composition (04C)

1. Load Explore. Confirm indexed token cards render and no blank page or crash occurs.
2. Visit Explore views `new`, `trending`, `graduating`, `graduated`; token detail; Create; Portfolio; Creator.
3. Confirm no unexpected horizontal scrolling at any point, including after rotation on mobile.
4. Mobile targets: confirm the 56px top bar, the 64px bottom navigation, and that safe-area insets are respected (notch/home indicator do not overlap controls). Desktop Edge: confirm the 64px sticky header and that layout is capped at 1440px.

### B. Truthful read state (04D / 06I)

5. Confirm freshness/delayed-data messaging is shown truthfully rather than as silently stale numbers.
6. Confirm a degraded or unavailable read says so plainly and does not fall back to raw-RPC primary UX.

### C. Wallet, network and transaction matrix (04D)

Report the wallet used by name, but do **not** describe any wallet as supported or first-class. Bread V1 claims generic injected EIP-1193 behavior only. A wallet becomes first-class only after Create, Buy, Sell, Claim **and** network-switch all execute with it — detection and connect alone never qualify.

7. Connect the wallet; confirm Bread reflects the connected state.
8. While on the wrong network, confirm the wrong-network state and the `Switch to Arc` prompt appear.
9. Add Arc Testnet, switch to it, and confirm Bread recognizes the switched network.
10. **Create** a token through the Create flow; confirm the review screen shows canonical values and that confirmation is driven by the `LaunchCreated` event.
11. **Buy** on the created token: review, submit, and confirm the status reaches `CONFIRMED` with exactly one submitted transaction.
12. **Sell** on the created token: review and submit.
13. **Claim** creator fees where a claimable balance exists; confirm the claimable value shown is the authoritative FeeEscrow value, and confirm a zero claimable balance produces no wallet write.
14. **Recovery:** while a Buy is pending, confirm it stays single-submit; then refresh mid-flight and confirm the pending transaction is restored and later confirmed **without a second wallet write**.

### D. Accessibility and motion (04D)

15. Desktop Edge: tab through the token page to the primary trade controls; confirm each is reachable and shows a visible focus ring. Open Search, close it with `Escape`, and confirm focus returns to the Search trigger.
16. iOS Safari / Android Chrome: with the software keyboard open over the trade sheet, confirm the amount input and the submit control remain reachable and usable.
17. Enable the OS "reduce motion" setting and confirm animation and transition are suppressed.
18. Confirm transaction status changes are announced by the screen reader (VoiceOver on iOS, TalkBack on Android, Narrator on Edge).

---

## Reporting

For each device report: device model, OS version, exact browser version, wallet name and version, the origin used, and per-step PASS / FAIL / NOT EXECUTED. Include the token address created and the transaction hashes observed.

A row is upgraded to `PASS` with `PHYSICAL_EXECUTION` only when every step above executed on that device. Any step not executed is recorded as NOT EXECUTED and the row stays `EXTERNAL_EXECUTION_REQUIRED` — partial coverage is recorded as partial, exactly as the macOS Safari row already is.

Results are transcribed into `docs/evidence/day9-browser-device-wallet-matrix.md`. Day 9 stays open, PR #93 stays draft, and no RC tag is created while any required row remains open.
