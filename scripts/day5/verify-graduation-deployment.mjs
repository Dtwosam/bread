import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const network = process.argv[2];
const rpcUrl = process.env.ARC_RPC_URL;

function fail(message) {
  console.error(`day5-verify: FAIL: ${message}`);
  process.exit(1);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function normalizeAddress(value) {
  const match = String(value).match(/0x[0-9a-fA-F]{40}/);
  return match?.[0].toLowerCase() ?? null;
}

function normalizeHash(value) {
  const match = String(value).match(/0x[0-9a-fA-F]{64}/);
  return match?.[0].toLowerCase() ?? null;
}

function castCall(address, signature, args = []) {
  const result = spawnSync("cast", ["call", address, signature, ...args, "--rpc-url", rpcUrl], {
    encoding: "utf8",
  });
  if (result.status !== 0) fail(`cast call failed: ${signature}: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

async function rpc(method, params) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) fail(`RPC HTTP ${response.status} for ${method}`);
  const body = await response.json();
  if (body.error) fail(`RPC ${method}: ${JSON.stringify(body.error)}`);
  return body.result;
}

function expectAddress(label, actual, expected) {
  if (normalizeAddress(actual) !== expected.toLowerCase()) {
    fail(`${label}: expected ${expected}, got ${actual}`);
  }
}

async function requireCode(label, address) {
  if (!normalizeAddress(address)) fail(`manifest address missing: ${label}`);
  const code = await rpc("eth_getCode", [address, "latest"]);
  if (!code || code === "0x") fail(`eth_getCode returned no code for ${label} ${address}`);
}

if (!network || !["arc-testnet", "arc-mainnet"].includes(network)) {
  fail("usage: ARC_RPC_URL=... node scripts/day5/verify-graduation-deployment.mjs <arc-testnet|arc-mainnet>");
}
if (!rpcUrl) fail("ARC_RPC_URL is required");

const networkManifest = readJson(`config/networks/${network}.json`);
const deployment = readJson(`config/deployments/${network}.day5.json`);
if (deployment.adapter?.active !== true) fail("deployment adapter is not active/ratified");
if (!["DEPLOYED", "VERIFIED"].includes(deployment.status)) fail("deployment manifest is not in DEPLOYED/VERIFIED state");

const core = deployment.core;
const addresses = {
  factory: core.factory,
  deployer: core.deployer,
  feePolicy: core.feePolicy,
  feeEscrow: core.feeEscrow,
  emergencyController: core.emergencyController,
  locker: core.locker,
  coordinator: core.coordinator,
  adapter: deployment.adapter.adapter,
  positionManager: deployment.adapter.positionManager,
};
for (const [label, address] of Object.entries(addresses)) await requireCode(label, address);

if (deployment.adapter.family === "UNISWAP_V3") {
  await requireCode("v3Factory", deployment.adapter.v3Factory);
} else if (deployment.adapter.family === "UNISWAP_V4") {
  await requireCode("poolManager", deployment.adapter.poolManager);
} else {
  fail(`unsupported adapter family ${deployment.adapter.family}`);
}

const protocolAdmin = deployment.authorities.protocolAdmin;
await requireCode("Protocol Admin Safe", protocolAdmin);

expectAddress("factory.graduationCoordinator", castCall(core.factory, "graduationCoordinator()(address)"), core.coordinator);
expectAddress("factory.launchDeployer", castCall(core.factory, "launchDeployer()(address)"), core.deployer);
expectAddress("coordinator.factory", castCall(core.coordinator, "factory()(address)"), core.factory);
expectAddress("coordinator.usdc", castCall(core.coordinator, "usdc()(address)"), networkManifest.usdc.address);
expectAddress("coordinator.feeEscrow", castCall(core.coordinator, "feeEscrow()(address)"), core.feeEscrow);
expectAddress(
  "coordinator.emergencyController",
  castCall(core.coordinator, "emergencyController()(address)"),
  core.emergencyController,
);
expectAddress("coordinator.locker", castCall(core.coordinator, "locker()(address)"), core.locker);
expectAddress("locker.coordinator", castCall(core.locker, "coordinator()(address)"), core.coordinator);

const authorizedCreditor = castCall(core.feeEscrow, "authorizedCreditor(address)(bool)", [core.coordinator]);
if (!/^true$/i.test(authorizedCreditor)) fail("FeeEscrow authorizedCreditor(coordinator) is not true");

expectAddress("adapter.usdc", castCall(deployment.adapter.adapter, "usdc()(address)"), networkManifest.usdc.address);
expectAddress("adapter.locker", castCall(deployment.adapter.adapter, "locker()(address)"), core.locker);
const configHash = normalizeHash(castCall(deployment.adapter.adapter, "configHash()(bytes32)"));
if (configHash !== deployment.adapter.configHash.toLowerCase()) fail("adapter configHash does not match manifest");

expectAddress("feePolicy.owner", castCall(core.feePolicy, "owner()(address)"), protocolAdmin);
expectAddress("factory.owner", castCall(core.factory, "owner()(address)"), protocolAdmin);
expectAddress("coordinator.owner", castCall(core.coordinator, "owner()(address)"), protocolAdmin);
expectAddress("feeEscrow.owner", castCall(core.feeEscrow, "owner()(address)"), protocolAdmin);
expectAddress("emergencyController.owner", castCall(core.emergencyController, "owner()(address)"), protocolAdmin);
expectAddress(
  "emergencyController.guardian",
  castCall(core.emergencyController, "guardian()(address)"),
  deployment.authorities.guardian,
);

console.log(`day5-verify: PASS (${network})`);
