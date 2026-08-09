import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function fail(message) {
  console.error(`day5-graduation-operations: FAIL: ${message}`);
  process.exit(1);
}

function requireFile(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) fail(`missing ${relativePath}`);
  return fs.readFileSync(absolute, "utf8");
}

const requiredFiles = [
  "contracts/script/DeployDay5Graduation.s.sol",
  "scripts/day5/configure-graduation.mjs",
  "scripts/day5/verify-graduation-deployment.mjs",
  "scripts/day5/smoke-graduation.mjs",
  "config/deployments/day5-graduation.schema.json",
  "config/deployments/arc-testnet.day5.json",
  "config/deployments/arc-mainnet.day5.json",
];

const contents = new Map(requiredFiles.map((file) => [file, requireFile(file)]));
const schema = JSON.parse(contents.get("config/deployments/day5-graduation.schema.json"));
if (schema.$id !== "bread://schemas/day5-graduation-deployment-v1") fail("unexpected Day-5 deployment schema id");
for (const field of ["network", "status", "chainId", "core", "adapter", "authorities", "deploymentStartBlock"]) {
  if (!schema.required?.includes(field)) fail(`deployment schema must require ${field}`);
}

for (const network of ["arc-testnet", "arc-mainnet"]) {
  const deploymentPath = `config/deployments/${network}.day5.json`;
  const deployment = JSON.parse(contents.get(deploymentPath));
  if (deployment.schema !== "bread://schemas/day5-graduation-deployment-v1") fail(`${deploymentPath} schema mismatch`);
  if (deployment.network !== network) fail(`${deploymentPath} network mismatch`);
  if (deployment.adapter?.active !== false) fail(`${deploymentPath} adapter must remain inactive`);
  if (deployment.adapter?.family !== null) fail(`${deploymentPath} adapter family must remain unresolved`);
  for (const key of ["adapter", "positionManager", "poolManager", "v3Factory"]) {
    if (deployment.adapter?.[key] !== null) fail(`${deploymentPath} must not guess ${key}`);
  }
  for (const key of ["factory", "deployer", "feePolicy", "feeEscrow", "emergencyController", "locker", "coordinator"]) {
    if (deployment.core?.[key] !== null) fail(`${deploymentPath} must not claim undeployed core ${key}`);
  }
  if (deployment.deploymentStartBlock !== null) fail(`${deploymentPath} deploymentStartBlock must remain null before deployment`);
}

const testnet = JSON.parse(requireFile("config/networks/arc-testnet.json"));
const mainnet = JSON.parse(requireFile("config/networks/arc-mainnet.json"));
for (const [name, network] of [["arc-testnet", testnet], ["arc-mainnet", mainnet]]) {
  if (["UNISWAP_V3", "UNISWAP_V4"].includes(network.dex?.type)) fail(`${name} network manifest must not activate a graduation DEX`);
  for (const key of ["poolManager", "positionManager", "factory"]) {
    if (network.dex?.[key] !== null) fail(`${name} network manifest must not guess dex.${key}`);
  }
}

const deploy = contents.get("contracts/script/DeployDay5Graduation.s.sol");
for (const marker of [
  "setCoordinator",
  "setGraduationCoordinator",
  "setLaunchDeployer",
  "setAuthorizedCreditor",
  "BREAD_PRODUCTION_ECONOMICS_CONFIG_REQUIRED",
  "ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED",
  "BREAD_DEPLOYMENT_AUTHORITY",
  "_handoffOwnership(deployment, input)",
  "input.protocolAdmin.code.length",
]) {
  if (!deploy.includes(marker)) fail(`deploy script missing marker ${marker}`);
}
const handoffCount = (deploy.match(/\.transferOwnership\(input\.protocolAdmin\)/g) ?? []).length;
if (handoffCount !== 5) fail(`deployment must hand exactly five Ownable surfaces to Protocol Admin, got ${handoffCount}`);
if (/VM\.addr\([^)]*\)\s*!=\s*input\.protocolAdmin/.test(deploy)) {
  fail("deployment key must not be forced to equal the Protocol Admin Safe");
}

const configure = contents.get("scripts/day5/configure-graduation.mjs");
for (const marker of ["ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED", "adapter.active", "graduationConfigHash"]) {
  if (!configure.includes(marker)) fail(`configure script missing marker ${marker}`);
}

const verify = contents.get("scripts/day5/verify-graduation-deployment.mjs");
for (const marker of [
  "eth_getCode",
  "graduationCoordinator",
  "authorizedCreditor",
  "configHash",
  "locker",
  "feePolicy.owner",
  "Protocol Admin Safe",
]) {
  if (!verify.includes(marker)) fail(`verify script missing marker ${marker}`);
}

const smoke = contents.get("scripts/day5/smoke-graduation.mjs");
for (const marker of [
  "FULL_LAUNCH_TRADE_GRADUATE_LOCK_PASS",
  "RETRY_CANNOT_DUPLICATE_LIQUIDITY",
  "replay",
  "permanent lock",
]) {
  if (!smoke.includes(marker)) fail(`smoke script missing marker ${marker}`);
}

console.log("day5-graduation-operations: PASS");
