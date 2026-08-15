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

function requireExactAddress(actual, expected, label) {
  if (actual?.toLowerCase() !== expected.toLowerCase()) {
    fail(`${label} mismatch`);
  }
}

function requireExactHash(actual, expected, label) {
  if (actual?.toLowerCase() !== expected.toLowerCase()) {
    fail(`${label} mismatch`);
  }
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

const testnetDeployment = JSON.parse(contents.get("config/deployments/arc-testnet.day5.json"));
if (testnetDeployment.schema !== "bread://schemas/day5-graduation-deployment-v1") fail("arc-testnet deployment schema mismatch");
if (testnetDeployment.network !== "arc-testnet") fail("arc-testnet deployment network mismatch");
if (testnetDeployment.status !== "VERIFIED") fail("arc-testnet deployment must remain VERIFIED");
if (testnetDeployment.chainId !== 5042002) fail("arc-testnet deployment chainId mismatch");

const expectedCore = {
  factory: "0xddf400f7a376fb8a962eee6d74c1ba37efa644f7",
  deployer: "0x89f70023c11b368d4ce5c6e4c100d4fa176f64fd",
  feePolicy: "0x388e534b94268e231a1badf14c4678f01bfc60e3",
  feeEscrow: "0xea9bb3330e0a2c9898776c75f549d06d2a644c94",
  emergencyController: "0xb6879be6a83b3a6e7a7de5cb841ca1550178ba42",
  locker: "0xecf66a3a221d90a413d9015803417aa8d4ba97fe",
  coordinator: "0x239da83ec8294b2433848ea8c85155f41e76f60a",
};
for (const [key, expected] of Object.entries(expectedCore)) {
  requireExactAddress(testnetDeployment.core?.[key], expected, `arc-testnet core.${key}`);
}

if (testnetDeployment.adapter?.active !== true) fail("arc-testnet adapter must remain active after verified deployment");
if (testnetDeployment.adapter?.family !== "UNISWAP_V3") fail("arc-testnet adapter family must remain UNISWAP_V3");
requireExactAddress(
  testnetDeployment.adapter?.adapter,
  "0xfe2378a81d655e051b53aba57271d2b4d5b5dd84",
  "arc-testnet adapter.adapter",
);
requireExactAddress(
  testnetDeployment.adapter?.positionManager,
  "0x444Cc395346428216fB6f2892eb03cB804aE4CD5",
  "arc-testnet adapter.positionManager",
);
requireExactAddress(
  testnetDeployment.adapter?.v3Factory,
  "0x0fB6EEDA6e90E90797083861A75D15752a27f59c",
  "arc-testnet adapter.v3Factory",
);
if (testnetDeployment.adapter?.poolManager !== null) fail("arc-testnet V3 adapter poolManager must remain null");
requireExactHash(
  testnetDeployment.adapter?.configHash,
  "0x4069e56d708b6bc2d4b003e09e6a566299b799bc8646732a901024fcf77781c7",
  "arc-testnet adapter.configHash",
);
requireExactAddress(
  testnetDeployment.authorities?.protocolAdmin,
  "0x9004e285521d69197cd9965c301b02161eb1d0d8",
  "arc-testnet Protocol Admin Safe",
);
requireExactAddress(
  testnetDeployment.authorities?.guardian,
  "0xdcb9cb7038ff1a282265a855754dba8695a3121c",
  "arc-testnet Guardian",
);
requireExactHash(
  testnetDeployment.economicsConfigHash,
  "0x081b597d7b603cb67d3921f269f7940a84221524b2d9baefc4f319c9f15f9747",
  "arc-testnet economicsConfigHash",
);
requireExactHash(
  testnetDeployment.dexEvidenceHash,
  "0xd30f72e114168ae2786f24e1375804d4ba1dd99822bbb292855597c60384ea26",
  "arc-testnet dexEvidenceHash",
);
if (testnetDeployment.deploymentStartBlock !== 56448201) fail("arc-testnet deploymentStartBlock mismatch");

const mainnetDeployment = JSON.parse(contents.get("config/deployments/arc-mainnet.day5.json"));
if (mainnetDeployment.schema !== "bread://schemas/day5-graduation-deployment-v1") fail("arc-mainnet deployment schema mismatch");
if (mainnetDeployment.network !== "arc-mainnet") fail("arc-mainnet deployment network mismatch");
if (mainnetDeployment.status !== "AWAITING_OFFICIAL_VALUES") fail("arc-mainnet deployment must remain unresolved");
if (mainnetDeployment.chainId !== null) fail("arc-mainnet chainId must remain unresolved");
if (mainnetDeployment.adapter?.active !== false) fail("arc-mainnet adapter must remain inactive");
if (mainnetDeployment.adapter?.family !== null) fail("arc-mainnet adapter family must remain unresolved");
for (const key of ["adapter", "positionManager", "poolManager", "v3Factory", "configHash"]) {
  if (mainnetDeployment.adapter?.[key] !== null) fail(`arc-mainnet deployment must not guess adapter.${key}`);
}
for (const key of ["factory", "deployer", "feePolicy", "feeEscrow", "emergencyController", "locker", "coordinator"]) {
  if (mainnetDeployment.core?.[key] !== null) fail(`arc-mainnet deployment must not claim core.${key}`);
}
for (const key of ["protocolAdmin", "guardian"]) {
  if (mainnetDeployment.authorities?.[key] !== null) fail(`arc-mainnet deployment must not guess authorities.${key}`);
}
if (mainnetDeployment.economicsConfigHash !== null) fail("arc-mainnet economicsConfigHash must remain unresolved");
if (mainnetDeployment.dexEvidenceHash !== null) fail("arc-mainnet dexEvidenceHash must remain unresolved");
if (mainnetDeployment.deploymentStartBlock !== null) fail("arc-mainnet deploymentStartBlock must remain null");

const testnet = JSON.parse(requireFile("config/networks/arc-testnet.json"));
if (testnet.chainId !== 5042002) fail("arc-testnet network chainId mismatch");
if (testnet.dex?.type !== "UNISWAP_V3") fail("arc-testnet network must use the verified generic UNISWAP_V3 dependency boundary");
if (testnet.dex?.poolManager !== null) fail("arc-testnet V3 network poolManager must remain null");
requireExactAddress(
  testnet.dex?.positionManager,
  "0x444Cc395346428216fB6f2892eb03cB804aE4CD5",
  "arc-testnet network dex.positionManager",
);
requireExactAddress(
  testnet.dex?.factory,
  "0x0fB6EEDA6e90E90797083861A75D15752a27f59c",
  "arc-testnet network dex.factory",
);

const mainnet = JSON.parse(requireFile("config/networks/arc-mainnet.json"));
if (mainnet.status !== "AWAITING_OFFICIAL_VALUES") fail("arc-mainnet network must remain awaiting official values");
if (mainnet.chainId !== null) fail("arc-mainnet network chainId must remain null");
if (mainnet.dex?.type !== "UNRESOLVED") fail("arc-mainnet network DEX must remain unresolved");
for (const key of ["poolManager", "positionManager", "factory"]) {
  if (mainnet.dex?.[key] !== null) fail(`arc-mainnet network must not guess dex.${key}`);
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
