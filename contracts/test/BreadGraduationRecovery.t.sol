// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../src/core/BreadBondingCurve.sol";
import {IGraduationCoordinator} from "../src/interfaces/IGraduationCoordinator.sol";
import {BreadDay5Fixture} from "./helpers/BreadDay5Fixture.sol";

interface BreadRecoveryVm {
    function warp(uint256 newTimestamp) external;
}

interface BreadRecoveryERC20 {
    function balanceOf(address account) external view returns (uint256);
}

contract BreadRecoveryRecipient {}

contract BreadGraduationRecoveryTest is BreadDay5Fixture {
    BreadRecoveryVm private constant VM =
        BreadRecoveryVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function testRescueRequiresSweptPausedAndSevenDayDelay() public {
        Fixture memory f = _deployDay5Fixture();
        (address token,) = _launchSwept(f);
        IGraduationCoordinator.GraduationRecord memory swept = f.coordinator.getGraduation(token);
        BreadRecoveryRecipient recipient = new BreadRecoveryRecipient();

        (bool unpausedOk,) = address(f.coordinator).call(
            abi.encodeWithSignature("rescueSweptGraduation(address,address)", token, address(recipient))
        );
        assert(!unpausedOk);

        f.emergencyController.setGraduationPaused(true);
        (bool earlyOk,) = address(f.coordinator).call(
            abi.encodeWithSignature("rescueSweptGraduation(address,address)", token, address(recipient))
        );
        assert(!earlyOk);

        VM.warp(uint256(swept.sweptAt) + f.coordinator.GRADUATION_RESCUE_DELAY());
        f.coordinator.rescueSweptGraduation(token, address(recipient));
        IGraduationCoordinator.GraduationRecord memory rescued = f.coordinator.getGraduation(token);

        assert(rescued.phase == IGraduationCoordinator.GraduationPhase.RESCUED);
        assert(rescued.sweptAt == 0);
        assert(rescued.sweptUsdc == 0);
        assert(rescued.sweptTokens == 0);
        assert(f.usdc.balanceOf(address(recipient)) == swept.sweptUsdc);
        assert(BreadRecoveryERC20(token).balanceOf(address(recipient)) == swept.sweptTokens);
        assert(f.coordinator.totalSweptUsdc() == 0);
    }

    function testSuccessfulPoolCreationMakesRescueUnavailable() public {
        Fixture memory f = _deployDay5Fixture();
        (address token,) = _launchSwept(f);
        MockPositionManagerNFTForRecovery manager = new MockPositionManagerNFTForRecovery();
        f.adapter.setPositionManager(manager.positionManager());
        f.coordinator.createPool(token);
        f.emergencyController.setGraduationPaused(true);
        VM.warp(block.timestamp + f.coordinator.GRADUATION_RESCUE_DELAY());

        (bool rescueOk,) = address(f.coordinator).call(
            abi.encodeWithSignature("rescueSweptGraduation(address,address)", token, address(this))
        );
        assert(!rescueOk);
        assert(
            f.coordinator.getGraduation(token).phase
                == IGraduationCoordinator.GraduationPhase.POOL_CREATED
        );
    }
}

import {MockPositionManagerNFT} from "./helpers/MockPositionManagerNFT.sol";

contract MockPositionManagerNFTForRecovery {
    MockPositionManagerNFT private immutable _manager = new MockPositionManagerNFT();

    function positionManager() external view returns (MockPositionManagerNFT) {
        return _manager;
    }
}
