// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadFeeEscrow} from "../src/fees/BreadFeeEscrow.sol";
import {BreadFeePolicy} from "../src/fees/BreadFeePolicy.sol";
import {BreadLaunchFactory} from "../src/factory/BreadLaunchFactory.sol";
import {BreadLaunchDeployer} from "../src/factory/BreadLaunchDeployer.sol";
import {BreadPermanentLiquidityLocker} from "../src/graduation/BreadPermanentLiquidityLocker.sol";
import {BreadEmergencyController} from "../src/security/BreadEmergencyController.sol";
import {IBreadLaunchFactory} from "../src/interfaces/IBreadLaunchFactory.sol";
import {BreadFeePolicySnapshot} from "../src/interfaces/IBreadFeePolicy.sol";
import {IGraduationAdapter} from "../src/interfaces/IGraduationAdapter.sol";
import {MockGraduationAdapter} from "./helpers/MockGraduationAdapter.sol";
import {MockGraduationCoordinator} from "./helpers/MockGraduationCoordinator.sol";
import {MockUSDC6} from "./helpers/MockUSDC6.sol";

contract BreadGraduationSnapshotTest {
    uint256 private constant ONE_USDC = 1_000_000;
    uint256 private constant SUPPLY = 1_000_000 ether;
    uint256 private constant PHANTOM_QUOTE = 10_000 * ONE_USDC;
    uint256 private constant GRADUATION_THRESHOLD = 100_000 * ONE_USDC;
    bytes32 private constant STACK_VERSION = keccak256("BREAD_DAY5_SNAPSHOT_TEST");
    bytes32 private constant ADAPTER_CONFIG_A = keccak256("ADAPTER_A");
    bytes32 private constant ADAPTER_CONFIG_B = keccak256("ADAPTER_B");

    function testLaunchSnapshotsGraduationDestinationAndFutureConfigCannotRewriteIt() public {
        MockUSDC6 usdc = new MockUSDC6();
        BreadFeePolicySnapshot memory policySnapshot = BreadFeePolicySnapshot({
            protocolFeeRecipient: address(0xA11CE),
            tradeFeeBps: 100,
            protocolFeeShareBps: 2_500,
            maxCreatorTaxBps: 500
        });
        BreadFeePolicy policy = new BreadFeePolicy(address(this), policySnapshot, address(this));
        BreadFeeEscrow escrow = new BreadFeeEscrow(address(usdc), address(this));
        BreadEmergencyController emergencyController = new BreadEmergencyController(address(this), address(0xBEEF));

        IBreadLaunchFactory.LaunchConfig memory bootstrap = IBreadLaunchFactory.LaunchConfig({
            supply: SUPPLY,
            phantomQuote: PHANTOM_QUOTE,
            graduationThreshold: GRADUATION_THRESHOLD,
            launchFeeUsdc: 0,
            graduationAdapter: address(0),
            graduationConfigHash: bytes32(0),
            enabled: false
        });

        BreadLaunchFactory factory = new BreadLaunchFactory(
            address(this),
            address(usdc),
            address(policy),
            address(escrow),
            address(emergencyController),
            bootstrap,
            STACK_VERSION
        );
        BreadLaunchDeployer deployer = new BreadLaunchDeployer(address(factory));
        factory.setLaunchDeployer(deployer);

        BreadPermanentLiquidityLocker locker = new BreadPermanentLiquidityLocker(address(this));
        MockGraduationCoordinator coordinator = new MockGraduationCoordinator(
            address(factory), address(usdc), address(escrow), address(emergencyController), address(locker)
        );
        locker.setCoordinator(address(coordinator));
        factory.setGraduationCoordinator(coordinator);

        MockGraduationAdapter adapterA = new MockGraduationAdapter(
            IGraduationAdapter.AdapterFamily.UNISWAP_V4, address(usdc), address(locker), ADAPTER_CONFIG_A
        );
        IBreadLaunchFactory.LaunchConfig memory enabledA = bootstrap;
        enabledA.graduationAdapter = address(adapterA);
        enabledA.graduationConfigHash = ADAPTER_CONFIG_A;
        enabledA.enabled = true;
        factory.setLaunchConfig(enabledA);

        IBreadLaunchFactory.LaunchParams memory params = _params(factory.previewLaunchEconomics());
        (address token,) = factory.launchToken(params);
        IBreadLaunchFactory.LaunchRecord memory first = factory.getLaunch(token);

        assert(first.graduationCoordinator == address(coordinator));
        assert(first.graduationAdapter == address(adapterA));
        assert(first.graduationAdapterFamily == IGraduationAdapter.AdapterFamily.UNISWAP_V4);
        assert(first.graduationConfigHash == ADAPTER_CONFIG_A);

        MockGraduationAdapter adapterB = new MockGraduationAdapter(
            IGraduationAdapter.AdapterFamily.UNISWAP_V3, address(usdc), address(locker), ADAPTER_CONFIG_B
        );
        IBreadLaunchFactory.LaunchConfig memory enabledB = enabledA;
        enabledB.graduationAdapter = address(adapterB);
        enabledB.graduationConfigHash = ADAPTER_CONFIG_B;
        factory.setLaunchConfig(enabledB);

        IBreadLaunchFactory.LaunchRecord memory unchanged = factory.getLaunch(token);
        assert(unchanged.graduationCoordinator == address(coordinator));
        assert(unchanged.graduationAdapter == address(adapterA));
        assert(unchanged.graduationAdapterFamily == IGraduationAdapter.AdapterFamily.UNISWAP_V4);
        assert(unchanged.graduationConfigHash == ADAPTER_CONFIG_A);
    }

    function _params(bytes32 expectedEconomics) private view returns (IBreadLaunchFactory.LaunchParams memory p) {
        p.name = "Bread Day5";
        p.symbol = "BD5";
        p.creatorFeeRecipient = address(this);
        p.creatorTaxBps = 100;
        p.expectedEconomics = expectedEconomics;
    }
}
