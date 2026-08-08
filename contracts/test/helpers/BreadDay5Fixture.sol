// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../../src/core/BreadBondingCurve.sol";
import {BreadFeeEscrow} from "../../src/fees/BreadFeeEscrow.sol";
import {BreadFeePolicy} from "../../src/fees/BreadFeePolicy.sol";
import {BreadLaunchFactory} from "../../src/factory/BreadLaunchFactory.sol";
import {BreadLaunchDeployer} from "../../src/factory/BreadLaunchDeployer.sol";
import {GraduationCoordinator} from "../../src/graduation/GraduationCoordinator.sol";
import {BreadPermanentLiquidityLocker} from "../../src/graduation/BreadPermanentLiquidityLocker.sol";
import {BreadEmergencyController} from "../../src/security/BreadEmergencyController.sol";
import {IBreadLaunchFactory} from "../../src/interfaces/IBreadLaunchFactory.sol";
import {BreadFeePolicySnapshot} from "../../src/interfaces/IBreadFeePolicy.sol";
import {IGraduationAdapter} from "../../src/interfaces/IGraduationAdapter.sol";
import {MockGraduationAdapter} from "./MockGraduationAdapter.sol";
import {MockUSDC6} from "./MockUSDC6.sol";

abstract contract BreadDay5Fixture {
    uint256 internal constant ONE_USDC = 1_000_000;
    uint256 internal constant DAY5_SUPPLY = 1_000_000 ether;
    uint256 internal constant DAY5_PHANTOM_QUOTE = 10_000 * ONE_USDC;
    uint256 internal constant DAY5_GRADUATION_THRESHOLD = 100_000 * ONE_USDC;
    uint16 internal constant DAY5_TRADE_FEE_BPS = 100;
    uint16 internal constant DAY5_PROTOCOL_SHARE_BPS = 2_500;
    uint16 internal constant DAY5_MAX_CREATOR_TAX_BPS = 500;
    uint16 internal constant DAY5_CREATOR_TAX_BPS = 500;
    bytes32 internal constant DAY5_STACK_VERSION = keccak256("BREAD_DAY5_STACK_TEST_V1");
    bytes32 internal constant DAY5_ADAPTER_CONFIG_HASH = keccak256("BREAD_DAY5_MOCK_ADAPTER_V1");

    address internal constant DAY5_PROTOCOL_RECIPIENT = address(0xA11CE);
    address internal constant DAY5_GUARDIAN = address(0xBEEF);

    struct Fixture {
        MockUSDC6 usdc;
        BreadFeePolicy policy;
        BreadFeeEscrow escrow;
        BreadEmergencyController emergencyController;
        BreadLaunchFactory factory;
        BreadLaunchDeployer deployer;
        BreadPermanentLiquidityLocker locker;
        GraduationCoordinator coordinator;
        MockGraduationAdapter adapter;
    }

    function _deployDay5Fixture() internal returns (Fixture memory f) {
        f.usdc = new MockUSDC6();
        f.policy = new BreadFeePolicy(
            address(this),
            BreadFeePolicySnapshot({
                protocolFeeRecipient: DAY5_PROTOCOL_RECIPIENT,
                tradeFeeBps: DAY5_TRADE_FEE_BPS,
                protocolFeeShareBps: DAY5_PROTOCOL_SHARE_BPS,
                maxCreatorTaxBps: DAY5_MAX_CREATOR_TAX_BPS
            }),
            address(this)
        );
        f.escrow = new BreadFeeEscrow(address(f.usdc), address(this));
        f.emergencyController = new BreadEmergencyController(address(this), DAY5_GUARDIAN);

        IBreadLaunchFactory.LaunchConfig memory bootstrap = IBreadLaunchFactory.LaunchConfig({
            supply: DAY5_SUPPLY,
            phantomQuote: DAY5_PHANTOM_QUOTE,
            graduationThreshold: DAY5_GRADUATION_THRESHOLD,
            launchFeeUsdc: 0,
            graduationAdapter: address(0),
            graduationConfigHash: bytes32(0),
            enabled: false
        });
        f.factory = new BreadLaunchFactory(
            address(this),
            address(f.usdc),
            address(f.policy),
            address(f.escrow),
            address(f.emergencyController),
            bootstrap,
            DAY5_STACK_VERSION
        );
        f.deployer = new BreadLaunchDeployer(address(f.factory));
        f.factory.setLaunchDeployer(f.deployer);

        f.locker = new BreadPermanentLiquidityLocker(address(this));
        f.coordinator = new GraduationCoordinator(
            address(this),
            address(f.factory),
            address(f.usdc),
            address(f.escrow),
            address(f.emergencyController),
            f.locker
        );
        f.locker.setCoordinator(address(f.coordinator));
        f.factory.setGraduationCoordinator(f.coordinator);
        f.escrow.setAuthorizedCreditor(address(f.coordinator), true);

        f.adapter = new MockGraduationAdapter(
            IGraduationAdapter.AdapterFamily.UNISWAP_V4,
            address(f.usdc),
            address(f.locker),
            DAY5_ADAPTER_CONFIG_HASH
        );
        bootstrap.graduationAdapter = address(f.adapter);
        bootstrap.graduationConfigHash = DAY5_ADAPTER_CONFIG_HASH;
        bootstrap.enabled = true;
        f.factory.setLaunchConfig(bootstrap);
    }

    function _launchReady(Fixture memory f) internal returns (address token, BreadBondingCurve curve) {
        (uint256 sellable, uint256 spent) = _finalFillNumbers();
        uint256 quoteIn = spent + 1_000 * ONE_USDC;
        f.usdc.mint(address(this), quoteIn);
        assert(f.usdc.approve(address(f.factory), quoteIn));

        address curveAddress;
        uint256 tokensOut;
        (token, curveAddress, tokensOut) = IBreadLaunchFactory(address(f.factory)).launchTokenAndBuy(
            _day5Params(f.factory.previewLaunchEconomics()), quoteIn, sellable, address(this)
        );
        assert(tokensOut == sellable);
        curve = BreadBondingCurve(curveAddress);
        assert(curve.readyToGraduate());
        assert(!curve.graduated());
    }

    function _launchSwept(Fixture memory f) internal returns (address token, BreadBondingCurve curve) {
        (token, curve) = _launchReady(f);
        f.coordinator.sweep(token);
    }

    function _day5Params(bytes32 expectedEconomics)
        internal
        view
        returns (IBreadLaunchFactory.LaunchParams memory p)
    {
        p.name = "Bread Day5";
        p.symbol = "BD5";
        p.creatorFeeRecipient = address(this);
        p.creatorTaxBps = DAY5_CREATOR_TAX_BPS;
        p.expectedEconomics = expectedEconomics;
    }

    function _finalFillNumbers() internal pure returns (uint256 sellable, uint256 spent) {
        uint256 reserved = DAY5_SUPPLY * DAY5_PHANTOM_QUOTE / (DAY5_PHANTOM_QUOTE + DAY5_GRADUATION_THRESHOLD);
        sellable = DAY5_SUPPLY - reserved;
        uint256 netRequired = _amountIn(sellable, DAY5_PHANTOM_QUOTE, DAY5_SUPPLY);
        spent = _ceilMulDiv(
            netRequired,
            10_000,
            10_000 - DAY5_TRADE_FEE_BPS - DAY5_CREATOR_TAX_BPS
        );
    }

    function _amountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut) internal pure returns (uint256) {
        return (amountOut * reserveIn * 10_000) / ((reserveOut - amountOut) * 10_000) + 1;
    }

    function _ceilMulDiv(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
        uint256 product = x * y;
        return product / denominator + (product % denominator == 0 ? 0 : 1);
    }
}
