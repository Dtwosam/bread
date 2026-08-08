// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadFeeEscrow} from "../../src/fees/BreadFeeEscrow.sol";
import {BreadLaunchFactory} from "../../src/factory/BreadLaunchFactory.sol";
import {BreadPermanentLiquidityLocker} from "../../src/graduation/BreadPermanentLiquidityLocker.sol";
import {IBreadLaunchFactory} from "../../src/interfaces/IBreadLaunchFactory.sol";
import {IGraduationAdapter} from "../../src/interfaces/IGraduationAdapter.sol";
import {MockGraduationAdapter} from "./MockGraduationAdapter.sol";
import {MockGraduationCoordinator} from "./MockGraduationCoordinator.sol";
import {MockUSDC6} from "./MockUSDC6.sol";

library BreadDay5TestWiring {
    bytes32 internal constant CONFIG_HASH = keccak256("BREAD_DAY5_CONTROLLED_TEST_GRADUATION");

    function wire(BreadLaunchFactory factory, MockUSDC6 usdc, BreadFeeEscrow escrow, address emergencyController)
        internal
        returns (
            BreadPermanentLiquidityLocker locker,
            MockGraduationCoordinator coordinator,
            MockGraduationAdapter adapter
        )
    {
        locker = new BreadPermanentLiquidityLocker(address(this));
        coordinator = new MockGraduationCoordinator(
            address(factory), address(usdc), address(escrow), emergencyController, address(locker)
        );
        locker.setCoordinator(address(coordinator));
        factory.setGraduationCoordinator(coordinator);

        adapter = new MockGraduationAdapter(
            IGraduationAdapter.AdapterFamily.UNISWAP_V4, address(usdc), address(locker), CONFIG_HASH
        );
        (IBreadLaunchFactory.LaunchConfig memory config,) = factory.currentLaunchConfig();
        config.graduationAdapter = address(adapter);
        config.graduationConfigHash = CONFIG_HASH;
        config.enabled = true;
        factory.setLaunchConfig(config);
    }
}
