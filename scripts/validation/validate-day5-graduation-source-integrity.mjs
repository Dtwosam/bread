import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const inventoryPath = path.join(root, "config/protocol/day5-dex-source-inventory.json");
const exactSha = /^[0-9a-f]{40}$/i;
const exactAddress = /^0x[0-9a-f]{40}$/i;
const exactHash = /^0x[0-9a-f]{64}$/i;

const ARC_TESTNET_CHAIN_ID = 5042002;
const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000";
const ARC_TESTNET_V3_FACTORY = "0x0fB6EEDA6e90E90797083861A75D15752a27f59c";
const ARC_TESTNET_V3_POSITION_MANAGER = "0x444Cc395346428216fB6f2892eb03cB804aE4CD5";
const DAY9_PROTOCOL_ADMIN_SAFE = "0x9004e285521d69197cd9965c301b02161eb1d0d8";
const DAY9_BREAD_FACTORY = "0xddf400f7a376fb8a962eee6d74c1ba37efa644f7";
const DAY9_GRADUATION_COORDINATOR = "0x239da83ec8294b2433848ea8c85155f41e76f60a";
const DAY9_PERMANENT_LOCKER = "0xecf66a3a221d90a413d9015803417aa8d4ba97fe";
const DAY9_V3_ADAPTER = "0xfe2378a81d655e051b53aba57271d2b4d5b5dd84";
const DAY9_DEPLOYMENT_SOURCE_COMMIT = "db0f6ed28e4a2475f54e84efadd7cf9693701353";
const DAY9_SMOKE_TOKEN = "0x9dc6c650929b641f93269a3b6d7d5237297d938b";
const DAY9_SMOKE_CURVE = "0x68db37eea822d42af898b9777a96bef022a0e36d";

function fail(message) {
  console.error(`day5-graduation-source-integrity: FAIL: ${message}`);
  process.exit(1);
}

function sameAddress(actual, expected) {
  return typeof actual === "string" && actual.toLowerCase() === expected.toLowerCase();
}

function requireExactAddress(value, label) {
  if (!exactAddress.test(value ?? "") || /^0x0{40}$/i.test(value ?? "")) {
    fail(`${label} must be a nonzero address`);
  }
}

function requireExactHash(value, label) {
  if (!exactHash.test(value ?? "") || /^0x0{64}$/i.test(value ?? "")) {
    fail(`${label} must be a nonzero bytes32 hash`);
  }
}

if (!fs.existsSync(inventoryPath)) {
  fail("missing config/protocol/day5-dex-source-inventory.json");
}

const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));

if (inventory.projectSourcePack !== "v1.5-day5-preflight-consolidated") {
  fail("unexpected Project Source pack");
}
if (inventory.checkedAt !== "2026-08-11") {
  fail("checkedAt must match the current reconciled Day-5/Day-9 source evidence date");
}

const official = inventory.uniswapV4?.officialSource;
if (!official) fail("missing official Uniswap V4 source block");
if (official.periphery?.repository !== "https://github.com/Uniswap/v4-periphery") fail("wrong V4 periphery repository");
if (official.periphery?.commit !== "545a5d2a87228167edde48f3b9eda122d1e3c4d6") fail("wrong V4 periphery commit");
if (official.core?.repository !== "https://github.com/Uniswap/v4-core") fail("wrong V4 core repository");
if (official.core?.commit !== "59d3ecf53afa9264a16bba0e38f4c5d2231f80bc") fail("wrong V4 core commit");
if (official.permit2?.repository !== "https://github.com/Uniswap/permit2") fail("wrong Permit2 repository");
if (official.permit2?.commit !== "cc56ad0f3439c502c246fc5cfcc3db92bb8b7219") fail("wrong Permit2 commit");

for (const [name, source] of Object.entries({
  periphery: official.periphery,
  core: official.core,
  permit2: official.permit2,
})) {
  if (!exactSha.test(source.commit ?? "")) fail(`${name} commit must be an exact 40-hex SHA`);
  if (!Array.isArray(source.files) || source.files.length === 0) fail(`${name} must list exact source files`);
  for (const file of source.files) {
    if (!file.path || !file.spdx) fail(`${name} source file is missing path/SPDX identity`);
  }
}

if (official.lockedByPeriphery !== true) fail("V4 core/Permit2 pins must be derived from the exact periphery lock");
if (inventory.uniswapV4?.implementationStatus !== "INACTIVE_OFFICIAL_INTERFACE_COMPATIBILITY_ONLY") {
  fail("Uniswap V4 implementation must remain inactive compatibility-only evidence");
}
if (inventory.uniswapV4?.arcDeployment?.status !== "NOT_LISTED_IN_OFFICIAL_V4_DEPLOYMENTS") {
  fail("Arc V4 deployment must remain unresolved while the retained official registry evidence has no Arc entry");
}
if (inventory.uniswapV4?.arcDeployment?.checkedAt !== "2026-08-09") {
  fail("Arc V4 deployment evidence date must preserve the retained official-registry check date");
}
if (inventory.uniswapV4?.arcDeployment?.activationAllowed !== false) {
  fail("Arc V4 must remain inactive without official deployment evidence");
}

const v3 = inventory.uniswapV3?.officialSource;
if (!v3) fail("missing official Uniswap V3 source block");
if (v3.periphery?.repository !== "https://github.com/Uniswap/v3-periphery") fail("wrong V3 periphery repository");
if (v3.periphery?.commit !== "0682387198a24c7cd63566a2c58398533860a5d1") fail("wrong V3 periphery commit");
if (v3.core?.repository !== "https://github.com/Uniswap/v3-core") fail("wrong V3 core repository");
if (v3.core?.commit !== "d0831dc6b8a318df3872b6d68f6de135c9f3ec29") fail("wrong V3 core commit");
for (const [name, source] of Object.entries({
  v3Periphery: v3.periphery,
  v3Core: v3.core,
})) {
  if (!exactSha.test(source.commit ?? "")) fail(`${name} commit must be an exact 40-hex SHA`);
  if (!Array.isArray(source.files) || source.files.length === 0) fail(`${name} must list exact source files`);
  for (const file of source.files) {
    if (!file.path || !file.spdx) fail(`${name} source file is missing path/SPDX identity`);
  }
}

if (inventory.uniswapV3?.implementationStatus !== "V3_COMPATIBLE_FALLBACK_ACTIVE_FOR_VERIFIED_ARC_TESTNET_DEPENDENCIES_ONLY") {
  fail("V3 implementation status must remain Arc-Testnet-only verified fallback");
}
if (inventory.uniswapV3?.activationAllowed !== true) {
  fail("verified Arc Testnet V3 fallback must be active in the testnet dependency manifest");
}
if (inventory.uniswapV3?.activationScope !== "ARC_TESTNET_DEPENDENCY_MANIFEST_ONLY") {
  fail("V3 activation must remain limited to the Arc Testnet dependency manifest");
}

const v3Arc = inventory.uniswapV3?.arcDeployment;
if (!v3Arc) fail("missing verified Arc Testnet V3 deployment evidence");
if (v3Arc.status !== "VERIFIED_V3_COMPATIBLE_ARC_TESTNET_DEPENDENCIES_REAL_DEPENDENCY_FORK_BREAD_DEPLOYMENT_AND_PUBLIC_SMOKE_PASS") {
  fail("unexpected Arc Testnet V3 evidence status");
}
if (v3Arc.checkedAt !== "2026-08-11") fail("Arc Testnet V3 evidence must use the current reconciliation date");
if (v3Arc.providerProvenance !== "Synthra") fail("Arc Testnet V3 provider provenance mismatch");
if (!sameAddress(v3Arc.factory, ARC_TESTNET_V3_FACTORY)) fail("Arc Testnet V3 Factory mismatch");
if (!sameAddress(v3Arc.positionManager, ARC_TESTNET_V3_POSITION_MANAGER)) fail("Arc Testnet V3 Position Manager mismatch");

const rpcCheck = v3Arc.independentRpcCheck;
if (rpcCheck?.chainId !== ARC_TESTNET_CHAIN_ID) fail("Arc Testnet V3 RPC evidence chain ID mismatch");
if (!(rpcCheck?.factoryCodeBytes > 0) || !(rpcCheck?.positionManagerCodeBytes > 0)) fail("Arc Testnet V3 dependencies must have runtime bytecode evidence");
if (rpcCheck?.positionManagerFactoryMatches !== true) fail("Position Manager must resolve to the verified V3 Factory");
if (!(rpcCheck?.usdcCodeBytes > 0) || rpcCheck?.usdcDecimals !== 6) fail("canonical Arc USDC RPC evidence mismatch");
if (rpcCheck?.feeAmountTickSpacing?.["3000"] !== 60) fail("verified Day-9 V3 fee tier/tick spacing evidence mismatch");

const forkProof = v3Arc.realDependencyForkProof;
if (forkProof?.status !== "PASS") fail("real dependency fork proof must remain PASS");
if (forkProof?.executedBranchHead !== "fe7bf6fcd33d2f23530dda54f18d29823cb9ce72") fail("real dependency fork proof head mismatch");
if (forkProof?.forkBlock !== 56439192) fail("real dependency fork proof block mismatch");
if (forkProof?.fee !== 3000) fail("real dependency fork proof fee mismatch");
if (forkProof?.liveTransactionBroadcast !== false) fail("fork proof must not claim a live transaction broadcast");

const safeAuthority = v3Arc.safeAuthority;
if (safeAuthority?.status !== "DAY9_ARC_SAFE_2_OF_3_PASS") fail("Arc Testnet Safe authority evidence must remain PASS");
if (!sameAddress(safeAuthority?.safe, DAY9_PROTOCOL_ADMIN_SAFE)) fail("Arc Testnet Protocol Admin Safe mismatch");
if (safeAuthority?.safeVersion !== "1.4.1" || safeAuthority?.threshold !== 2 || safeAuthority?.ownerCount !== 3) {
  fail("Arc Testnet Protocol Admin Safe threshold/version evidence mismatch");
}
if (safeAuthority?.productionAuthorityClaim !== false) fail("testnet Safe evidence must not make a production authority claim");

const deployment = v3Arc.publicTestnetDeploymentPlan;
if (deployment?.status !== "DEPLOYMENT_VERIFY_AND_PUBLIC_LIFECYCLE_SMOKE_PASS") {
  fail("Arc Testnet Bread deployment/lifecycle evidence must remain PASS");
}
if (deployment?.sourceCommit !== DAY9_DEPLOYMENT_SOURCE_COMMIT) fail("Arc Testnet Bread deployment source commit mismatch");
if (deployment?.deploymentStartBlock !== 56448201) fail("Arc Testnet Bread deployment start block mismatch");
if (!sameAddress(deployment?.protocolAdminSafe, DAY9_PROTOCOL_ADMIN_SAFE)) fail("deployment Protocol Admin Safe mismatch");
if (!sameAddress(deployment?.breadFactory, DAY9_BREAD_FACTORY)) fail("deployed Bread Factory mismatch");
if (!sameAddress(deployment?.graduationCoordinator, DAY9_GRADUATION_COORDINATOR)) fail("deployed Graduation Coordinator mismatch");
if (!sameAddress(deployment?.permanentLiquidityLocker, DAY9_PERMANENT_LOCKER)) fail("deployed permanent locker mismatch");
if (!sameAddress(deployment?.graduationAdapter, DAY9_V3_ADAPTER)) fail("deployed V3 adapter mismatch");
requireExactHash(deployment?.adapterConfigHash, "adapter config hash");
requireExactHash(deployment?.economicsConfigHash, "economics config hash");
requireExactHash(deployment?.dexEvidenceHash, "DEX evidence hash");
if (deployment?.v3Fee !== 3000) fail("public testnet V3 fee mismatch");
if (deployment?.productionMoneyClaim !== false) fail("public testnet deployment must not claim production money readiness");

const smoke = deployment?.smoke;
if (smoke?.status !== "PASS") fail("public Arc Testnet lifecycle smoke must remain PASS");
if (!sameAddress(smoke?.token, DAY9_SMOKE_TOKEN)) fail("canonical Day-9 smoke token mismatch");
if (!sameAddress(smoke?.curve, DAY9_SMOKE_CURVE)) fail("canonical Day-9 smoke curve mismatch");
if (!sameAddress(smoke?.positionManager, ARC_TESTNET_V3_POSITION_MANAGER)) fail("smoke Position Manager mismatch");
if (smoke?.positionId !== "265870") fail("canonical Day-9 LP position ID mismatch");
if (!sameAddress(smoke?.nftOwner, DAY9_PERMANENT_LOCKER)) fail("canonical Day-9 LP NFT owner mismatch");
if (smoke?.creatorClaimLogCount !== 1 || smoke?.creatorClaimRemaining !== "0") fail("creator-claim smoke evidence mismatch");
if (smoke?.graduationResidueZero !== true || smoke?.replayRejected !== true) fail("graduation/replay smoke evidence mismatch");
if (!Array.isArray(smoke?.transactionHashes) || smoke.transactionHashes.length !== 4) fail("canonical smoke transaction evidence mismatch");
for (const hash of smoke.transactionHashes) requireExactHash(hash, "smoke transaction hash");

if (inventory.arc?.mainnet?.status !== "WAITING_FOR_OFFICIAL_PUBLICATION") {
  fail("Arc mainnet values must remain an official-publication gate");
}
if (inventory.arc?.mainnet?.contractAddresses !== null || inventory.arc?.mainnet?.rpcParameters !== null || inventory.arc?.mainnet?.graduationDex !== null) {
  fail("Arc mainnet values must remain unresolved");
}
if (inventory.arc?.testnet?.status !== "OFFICIAL_TESTNET_VALUES_VERIFIED") fail("Arc testnet source status mismatch");
if (inventory.arc?.testnet?.chainId !== ARC_TESTNET_CHAIN_ID) fail("Arc testnet chain ID mismatch");
if (!sameAddress(inventory.arc?.testnet?.canonicalUsdc, ARC_TESTNET_USDC)) fail("Arc testnet canonical USDC mismatch");
if (inventory.arc?.testnet?.usdcDecimals !== 6) fail("Arc testnet USDC must be 6 decimals");
if (inventory.ponsReference?.role !== "REFERENCE_ONLY") fail("Pons must remain reference-only");
if (!exactSha.test(inventory.ponsReference?.commit ?? "")) fail("Pons reference must use exact commit");

if (inventory.activationPolicy?.arcV4 !== "BLOCKED_UNTIL_OFFICIAL_DEPLOYMENT_EVIDENCE_AND_COMPATIBILITY_PASS") {
  fail("Arc V4 activation policy mismatch");
}
if (inventory.activationPolicy?.arcV3Testnet !== "VERIFIED_DEPENDENCY_FORK_BREAD_DEPLOYMENT_AND_PUBLIC_LIFECYCLE_SMOKE_PASS") {
  fail("Arc Testnet V3 activation policy mismatch");
}
if (inventory.activationPolicy?.arcV3Mainnet !== "REQUIRES_FRESH_MAINNET_DEPLOYMENT_EVIDENCE_AND_COMPATIBILITY_PASS") {
  fail("Arc mainnet V3 must require fresh independent evidence");
}
if (inventory.activationPolicy?.mainnet !== "ARC_MAINNET_VALUES_REQUIRED") fail("Arc mainnet activation gate mismatch");

const testnetManifest = JSON.parse(
  fs.readFileSync(path.join(root, "config/networks/arc-testnet.json"), "utf8"),
);
if (testnetManifest.network !== "arc-testnet" || testnetManifest.chainId !== ARC_TESTNET_CHAIN_ID) {
  fail("Arc Testnet network manifest identity mismatch");
}
if (!sameAddress(testnetManifest.usdc?.address, ARC_TESTNET_USDC) || testnetManifest.usdc?.decimals !== 6) {
  fail("Arc Testnet network manifest USDC mismatch");
}
if (testnetManifest.dex?.type !== "UNISWAP_V3") fail("Arc Testnet must use the verified generic UNISWAP_V3 dependency family");
if (testnetManifest.dex?.poolManager !== null) fail("Arc Testnet V3 manifest must not set a V4 PoolManager");
if (!sameAddress(testnetManifest.dex?.positionManager, ARC_TESTNET_V3_POSITION_MANAGER)) fail("Arc Testnet manifest Position Manager mismatch");
if (!sameAddress(testnetManifest.dex?.factory, ARC_TESTNET_V3_FACTORY)) fail("Arc Testnet manifest V3 Factory mismatch");

const mainnetManifest = JSON.parse(
  fs.readFileSync(path.join(root, "config/networks/arc-mainnet.json"), "utf8"),
);
if (mainnetManifest.status !== "AWAITING_OFFICIAL_VALUES" || mainnetManifest.chainId !== null) {
  fail("Arc mainnet manifest must remain unresolved");
}
if (mainnetManifest.usdc?.address !== null || mainnetManifest.dex?.type !== "UNRESOLVED") {
  fail("Arc mainnet financial/DEX values must not be invented");
}
if (
  mainnetManifest.dex?.poolManager !== null
  || mainnetManifest.dex?.positionManager !== null
  || mainnetManifest.dex?.factory !== null
) {
  fail("Arc mainnet DEX dependencies must remain null until independently verified");
}

for (const value of [
  ARC_TESTNET_USDC,
  ARC_TESTNET_V3_FACTORY,
  ARC_TESTNET_V3_POSITION_MANAGER,
  DAY9_PROTOCOL_ADMIN_SAFE,
  DAY9_BREAD_FACTORY,
  DAY9_GRADUATION_COORDINATOR,
  DAY9_PERMANENT_LOCKER,
  DAY9_V3_ADAPTER,
  DAY9_SMOKE_TOKEN,
  DAY9_SMOKE_CURVE,
]) {
  requireExactAddress(value, "pinned Day-9 address");
}

console.log("day5-graduation-source-integrity: PASS");
