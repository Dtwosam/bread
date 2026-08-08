import { readFile } from "node:fs/promises";

const inventoryPath =
  "config/protocol/day4-launch-control-source-inventory.json";
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));

function requireEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

requireEqual(
  inventory.projectSourcePack,
  "v1.4-day4-design",
  "Day 4 Project Source Pack",
);
requireEqual(
  inventory.acceptedMain,
  "ef03e60f9bbd5737a991dd3b1b747866d8ad8f3a",
  "Day 4 accepted production-start main",
);
requireEqual(
  inventory.approvedDesign,
  "324b6055a0bed278766e1b48016774ac745b3781",
  "Day 4 approved design commit",
);
requireEqual(
  inventory.ponsReference?.repo,
  "ponsdotdev/ponsfamily",
  "Pons reference repo",
);
requireEqual(
  inventory.ponsReference?.commit,
  "d5491e20be56051a68abf47136f6890c3ce3ff7d",
  "Pons reference commit",
);
requireEqual(
  inventory.ponsReference?.factory,
  "contractsV2/src/v2/PonsV2LaunchFactory.sol",
  "Pons factory reference path",
);
requireEqual(
  inventory.ponsReference?.deployer,
  "contractsV2/src/v2/PonsV2LaunchDeployer.sol",
  "Pons deployer reference path",
);
requireEqual(
  inventory.ponsReference?.role,
  "REFERENCE_ONLY",
  "Pons reference role",
);
requireEqual(
  inventory.clankerOpeningReference?.repo,
  "clanker-devco/v4-contracts",
  "Clanker reference repo",
);
requireEqual(
  inventory.clankerOpeningReference?.commit,
  "b004c2edda29fa282a16d5d1441a26484f70b37f",
  "Clanker reference commit",
);
requireEqual(
  inventory.clankerOpeningReference?.path,
  "src/mev-modules/ClankerMevDescendingFees.sol",
  "Clanker opening reference path",
);
requireEqual(
  inventory.clankerOpeningReference?.role,
  "REFERENCE_ONLY",
  "Clanker reference role",
);
requireEqual(
  inventory.openingPolicy?.startingBps,
  9900,
  "opening starting bps",
);
requireEqual(inventory.openingPolicy?.durationSeconds, 5, "opening duration");
requireEqual(inventory.openingPolicy?.terminalBps, 0, "opening terminal bps");
requireEqual(
  inventory.openingPolicy?.routing,
  "QUOTE_FEE_BALANCE",
  "opening-tax routing",
);
requireEqual(
  inventory.liveRuntimeValues,
  "NOT_FROZEN_DO_NOT_INVENT",
  "live-runtime freeze state",
);
requireEqual(
  inventory.currentPonsFactoryParity,
  "NOT_CLAIMED",
  "current Pons parity claim",
);

const curveSource = await readFile(
  "contracts/src/core/BreadBondingCurve.sol",
  "utf8",
);
const factorySource = await readFile(
  "contracts/src/factory/BreadLaunchFactory.sol",
  "utf8",
);
const emergencySource = await readFile(
  "contracts/src/security/BreadEmergencyController.sol",
  "utf8",
);
const buildState = await readFile("docs/current-build-state.yaml", "utf8");

for (const [source, needle, label] of [
  [curveSource, "STARTING_SNIPE_TAX_BPS = 9_900", "curve starting snipe tax"],
  [curveSource, "SNIPE_DURATION_SECONDS = 5", "curve snipe duration"],
  [curveSource, "TERMINAL_SNIPE_TAX_BPS = 0", "curve terminal snipe tax"],
  [
    curveSource,
    "quoteFeeBalance += quoted.charges.fee + quoted.charges.snipeTax",
    "opening-tax canonical routing",
  ],
  [
    curveSource,
    "launchBuyExemptionConsumed = true",
    "one-use launch-buy exemption latch",
  ],
  [curveSource, "Math.Rounding.Ceil", "full-precision final-fill ceiling"],
  [
    factorySource,
    "OPENING_PROTECTION_POLICY_ID",
    "factory opening-policy digest binding",
  ],
  [factorySource, "OPENING_TAX_ROUTING_ID", "factory routing digest binding"],
  [
    factorySource,
    "emergencyController.launchesAllowed()",
    "factory emergency launch gate",
  ],
  [
    emergencySource,
    "GuardianCannotReduceRestriction",
    "guardian tighten-only rule",
  ],
  [
    buildState,
    "pack: v1.4-day4-design",
    "ratified Day 4 build-state source pack",
  ],
  [
    buildState,
    "day4_production_ratification: RATIFIED",
    "Day 4 production ratification state",
  ],
]) {
  if (!source.includes(needle)) {
    throw new Error(`missing ${label}: ${needle}`);
  }
}

for (const prohibited of [
  "ARC_MAINNET_RPC",
  "ARC_MAINNET_CHAIN_ID",
  "LIVE_LAUNCH_FEE_USDC",
]) {
  if (JSON.stringify(inventory).includes(prohibited)) {
    throw new Error(
      `Day 4 source inventory must not freeze live runtime value ${prohibited}`,
    );
  }
}

console.log("day4-launch-control-source-integrity-validation: PASS");
