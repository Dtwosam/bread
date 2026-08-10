import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const network = process.argv[2];
const rpcUrl = process.env.ARC_RPC_URL;

const FULL_LAUNCH_TRADE_GRADUATE_LOCK_PASS = "FULL_LAUNCH_TRADE_GRADUATE_LOCK_PASS";
const RETRY_CANNOT_DUPLICATE_LIQUIDITY = "RETRY_CANNOT_DUPLICATE_LIQUIDITY";
const permanentLockExpectation = "permanent lock";
const replayExpectation = "replay rejection";

function fail(message) {
  console.error(`day5-smoke: FAIL: ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: "pipe", ...options });
  if (result.status !== 0) {
    fail(`${command} ${args.join(" ")} failed\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  }
  return result;
}

if (!network || !["arc-testnet", "arc-mainnet"].includes(network)) {
  fail("usage: ARC_RPC_URL=... node scripts/day5/smoke-graduation.mjs <arc-testnet|arc-mainnet>");
}
if (!rpcUrl) fail("ARC_RPC_URL is required");

// A live smoke is forbidden unless configure + wiring verification already pass.
run(process.execPath, ["scripts/day5/configure-graduation.mjs", network], { cwd: root });
run(process.execPath, ["scripts/day5/verify-graduation-deployment.mjs", network], {
  cwd: root,
  env: process.env,
});

// Forge already executes the complete Solidity script locally before it builds
// the broadcast sequence. This smoke contains state-dependent transactions
// (notably graduation sweep -> pool creation) whose duplicate on-chain batch
// simulation cannot observe the prior transaction's yet-unconfirmed state.
// --skip-simulation skips only that secondary on-chain simulation; --slow then
// sends each transaction only after the preceding transaction is confirmed.
run(
  "forge",
  [
    "script",
    "script/SmokeDay5Graduation.s.sol:SmokeDay5Graduation",
    "--rpc-url",
    rpcUrl,
    "--skip-simulation",
    "--slow",
    "--broadcast",
    "-vvv",
  ],
  { cwd: path.join(root, "contracts"), env: process.env },
);

console.log(
  `day5-smoke: PASS ${FULL_LAUNCH_TRADE_GRADUATE_LOCK_PASS} ${RETRY_CANNOT_DUPLICATE_LIQUIDITY} (${permanentLockExpectation}; ${replayExpectation})`,
);
