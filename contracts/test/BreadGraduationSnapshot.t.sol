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

    struct Fixture {
        MockUSDC6 usdc;
        BreadLaunchFactory factory;
        BreadPermanentLiquidityLocker locker;
        MockGraduationCoordinator coordinator;
    }

    function testLaunchSnapshotsGraduationDestinationAndFutureConfigCannotRewriteIt() public {
        Fixture memory f = _deployFixture();
        MockGraduationAdapter adapterA = _setAdapter(
            f, IGraduationAdapter.AdapterFamily.UNISWAP_V4, ADAPTER_CONFIG_A
        );

        (address token,) = f.factory.launchToken(_params(f.factory.previewLaunchEconomics()));
        _assertSnapshot(
            f.factory.getLaunch(token), address(f.coordinator), address(adapterA),
            IGraduationAdapter.AdapterFamily.UNISWAP_V4, ADAPTER_CONFIG_A
        );

        _setAdapter(f, IGraduationAdapter.AdapterFamily.UNISWAP_V3, ADAPTER_CONFIG_B);

        _assertSnapshot(
            f.factory.getLaunch(token), address(f.coordinator), address(adapterA),
            IGraduationAdapter.AdapterFamily.UNISWAP_V4, ADAPTER_CONFIG_A
        );
    }

    function _deployFixture() private returns (Fixture memory f) {
        f.usdc = new MockUSDC6();
        BreadFeePolicy policy = new BreadFeePolicy(
            address(this),
            BreadFeePolicySnapshot({
                protocolFeeRecipient: address(0xA11CE),
                tradeFeeBps: 100,
                protocolFeeShareBps: 2_500,
                maxCreatorTaxBps: 500
            }),
            address(this)
        );
        BreadFeeEscrow escrow = new BreadFeeEscrow(address(f.usdc), address(this));
        BreadEmergencyController emergencyController = new BreadEmergencyController(address(this), address(0xBEEF));
        IBreadLaunchFactory.LaunchConfig memory bootstrap = _bootstrapConfig();

        f.factory = new BreadLaunchFactory(
            address(this), address(f.usdc), address(policy), address(escrow),
            address(emergencyController), bootstrap, STACK_VERSION
        );
        f.factory.setLaunchDeployer(new BreadLaunchDeployer(address(f.factory)));

        f.locker = new BreadPermanentLiquidityLocker(address(this));
        f.coordinator = new MockGraduationCoordinator(
            address(f.factory), address(f.usdc), address(escrow), address(emergencyController), address(f.locker)
        );
        f.locker.setCoordinator(address(f.coordinator));
        f.factory.setGraduationCoordinator(f.coordinator);
    }

    function _setAdapter(Fixture memory f, IGraduationAdapter.AdapterFamily family, bytes32 configHash)
        private
        returns (MockGraduationAdapter adapter)
    {
        adapter = new MockGraduationAdapter(family, address(f.usdc), address(f.locker), configHash);
        IBreadLaunchFactory.LaunchConfig memory config = _bootstrapConfig();
        config.graduationAdapter = address(adapter);
        config.graduationConfigHash = configHash;
        config.enabled = true;
        f.factory.setLaunchConfig(config);
    }

    function _bootstrapConfig() private pure returns (IBreadLaunchFactory.LaunchConfig memory config) {
        config = IBreadLaunchFactory.LaunchConfig({
            supply: SUPPLY,
            phantomQuote: PHANTOM_QUOTE,
            graduationThreshold: GRADUATION_THRESHOLD,
            launchFeeUsdc: 0,
            graduationAdapter: address(0),
            graduationConfigHash: bytes32(0),
            enabled: false
        });
    }

    function _assertSnapshot(
        IBreadLaunchFactory.LaunchRecord memory record,
        address coordinator,
        address adapter,
        IGraduationAdapter.AdapterFamily family,
        bytes32 configHash
    ) private pure {
        assert(record.graduationCoordinator == coordinator);
        assert(record.graduationAdapter == adapter);
        assert(record.graduationAdapterFamily == family);
        assert(record.graduationConfigHash == configHash);
    }

    function _params(bytes32 expectedEconomics) private view returns (IBreadLaunchFactory.LaunchParams memory p) {
        p.name = "Bread Day5";
        p.symbol = "BD5";
        p.creatorFeeRecipient = address(this);
        p.creatorTaxBps = 100;
        p.expectedEconomics = expectedEconomics;
    }
}
