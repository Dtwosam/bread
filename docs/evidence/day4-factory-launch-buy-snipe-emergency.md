# Day 4 Factory / Launch+Buy / Opening Protection / Emergency Evidence

Status: **TDD IN PROGRESS — NO DAY-4 PASS**

## Accepted start

- merged Day-4 preflight main: `ef03e60f9bbd5737a991dd3b1b747866d8ad8f3a`
- Project Source Pack: `v1.4-day4-design`
- Day-4 production ratification: `RATIFIED`
- implementation branch: `checkpoint/day4-launch-control`
- draft implementation PR: `#15`

## Task 1 — Factory / Deployer RED

- exact RED checkpoint retained as branch `checkpoint/day4-launch-control-red`
- RED behavior commit: `0356e6d39b699df37124cea1c4f57949f3cf86a8`
- PR RED head used by CI: `a07e7a9fe945bc6c39d7ee9c83a0ed8cee9349fb`
- required behavior fixture: `contracts/test/BreadLaunchFactory.t.sol`
- production `BreadLaunchFactory.sol` and `BreadLaunchDeployer.sol` intentionally absent
- CI run: `31270305259`
- `bootstrap-validation`: PASS
- `foundry-bootstrap`: EXPECTED RED at `forge build`
- exact Foundry cause: unresolved imports `src/factory/BreadLaunchFactory.sol` and `src/factory/BreadLaunchDeployer.sol`
- no unrelated Solidity/compiler failure was observed before those missing sources
- Task-1 GREEN: PENDING

No local/component result in this document is Day-4 PASS. The final verdict is permitted only after integrated exact-head implementation CI, guarded merge, fresh merged-main closeout and exact-head closeout CI.
