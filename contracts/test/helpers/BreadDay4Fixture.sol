// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadFeeEscrow} from "../../src/fees/BreadFeeEscrow.sol";
import {BreadFeePolicy} from "../../src/fees/BreadFeePolicy.sol";
import {BreadLaunchFactory} from "../../src/factory/BreadLaunchFactory.sol";
import {BreadLaunchDeployer} from "../../src/factory/BreadLaunchDeployer.sol";
import {BreadEmergencyController} from "../../src/security/BreadEmergencyController.sol";
import {IBreadLaunchFactory} from "../../src/interfaces/IBreadLaunchFactory.sol";
import {BreadFeePolicySnapshot} from "../../src/interfaces/IBreadFeePolicy.sol";
import {MockUSDC6} from "./MockUSDC6.sol";

abstract contract BreadDay4Fixture {
    uint256 internal constant ONE_USDC = 1_000_000;
    uint256 internal constant DAY4_SUPPLY = 1_000_000 ether;
    uint256 internal constant DAY4_PHANTOM_QUOTE = 10_000 * ONE_USDC;
    uint256 internal constant DAY4_GRADUATION_THRESHOLD = 100_000 * ONE_USDC;
    uint256 internal constant DAY4_LAUNCH_FEE = 10 * ONE_USDC;
    uint16 internal constant DAY4_TRADE_FEE_BPS = 100;
    uint16 internal constant DAY4_PROTOCOL_SHARE_BPS = 2_500;
    uint16 internal constant DAY4_MAX_CREATOR_TAX_BPS = 500;
    uint16 internal constant DAY4_CREATOR_TAX_BPS = 500;
    bytes32 internal constant DAY4_STACK_VERSION = keccak256("BREAD_DAY4_STACK_V1");

    address internal constant DAY4_PROTOCOL_RECIPIENT = address(0xA11CE);
    address internal constant DAY4_GUARDIAN = address(0xBEEF);

    struct Day4Fixture {
        MockUSDC6 usdc;
        BreadFeePolicy policy;
        BreadFeeEscrow escrow;
        BreadEmergencyController emergencyController;
        BreadLaunchFactory factory;
        BreadLaunchDeployer deployer;
    }

    function _deployDay4Fixture(uint256 launchFee) internal returns (Day4Fixture memory f) {
        return _deployDay4FixtureWithGuardian(launchFee, DAY4_GUARDIAN);
    }

    function _deployDay4FixtureWithGuardian(uint256 launchFee, address guardian)
        internal
        returns (Day4Fixture memory f)
    {
        f.usdc = new MockUSDC6();
        BreadFeePolicySnapshot memory snapshot = BreadFeePolicySnapshot({
            protocolFeeRecipient: DAY4_PROTOCOL_RECIPIENT,
            tradeFeeBps: DAY4_TRADE_FEE_BPS,
            protocolFeeShareBps: DAY4_PROTOCOL_SHARE_BPS,
            maxCreatorTaxBps: DAY4_MAX_CREATOR_TAX_BPS
        });
        f.policy = new BreadFeePolicy(address(this), snapshot, address(this));
        f.escrow = new BreadFeeEscrow(address(f.usdc), address(this));
        f.emergencyController = new BreadEmergencyController(address(this), guardian);

        IBreadLaunchFactory.LaunchConfig memory config = IBreadLaunchFactory.LaunchConfig({
            supply: DAY4_SUPPLY,
            phantomQuote: DAY4_PHANTOM_QUOTE,
            graduationThreshold: DAY4_GRADUATION_THRESHOLD,
            launchFeeUsdc: launchFee,
            enabled: false
        });
        f.factory = new BreadLaunchFactory(
            address(this),
            address(f.usdc),
            address(f.policy),
            address(f.escrow),
            address(f.emergencyController),
            config,
            DAY4_STACK_VERSION
        );
        f.deployer = new BreadLaunchDeployer(address(f.factory));
        f.factory.setLaunchDeployer(f.deployer);
        config.enabled = true;
        f.factory.setLaunchConfig(config);
    }

    function _day4Params(bytes32 expectedEconomics)
        internal
        view
        returns (IBreadLaunchFactory.LaunchParams memory p)
    {
        p.name = "Bread Day4";
        p.symbol = "BD4";
        p.logo = "";
        p.description = "";
        p.twitter = "";
        p.telegram = "";
        p.discord = "";
        p.website = "";
        p.farcaster = "";
        p.creatorFeeRecipient = address(this);
        p.creatorTaxBps = DAY4_CREATOR_TAX_BPS;
        p.expectedEconomics = expectedEconomics;
    }
}
