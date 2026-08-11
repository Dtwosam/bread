// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {
    Day9ProtocolAdminHarness,
    Day9RehearsalUSDC6,
    Day9RehearsalV3Factory,
    Day9RehearsalV3PositionManager
} from "../../src/rehearsal/Day9ControlledDependencies.sol";

interface Day9RehearsalVm {
    function envUint(string calldata name) external returns (uint256 value);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

/// @notice TEST/REHEARSAL ONLY dependency bootstrap for a temporary local Anvil chain.
contract DeployDay9ControlledDependencies {
    Day9RehearsalVm private constant VM =
        Day9RehearsalVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint24 internal constant V3_FEE = 3_000;
    int24 internal constant V3_TICK_SPACING = 60;

    struct Deployment {
        Day9RehearsalUSDC6 usdc;
        Day9ProtocolAdminHarness protocolAdmin;
        Day9RehearsalV3Factory v3Factory;
        Day9RehearsalV3PositionManager positionManager;
    }

    function run() external returns (Deployment memory deployment) {
        uint256 key = VM.envUint("BREAD_DEPLOYER_PRIVATE_KEY");
        VM.startBroadcast(key);
        deployment.usdc = new Day9RehearsalUSDC6();
        deployment.protocolAdmin = new Day9ProtocolAdminHarness();
        deployment.v3Factory = new Day9RehearsalV3Factory();
        deployment.v3Factory.setFeeAmount(V3_FEE, V3_TICK_SPACING);
        deployment.positionManager = new Day9RehearsalV3PositionManager(address(deployment.v3Factory));
        VM.stopBroadcast();
    }
}
