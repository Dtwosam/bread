// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../src/core/BreadBondingCurve.sol";
import {BreadLaunchToken} from "../src/BreadLaunchToken.sol";
import {BreadFeeEscrow} from "../src/fees/BreadFeeEscrow.sol";
import {BreadFeePolicy} from "../src/fees/BreadFeePolicy.sol";
import {BreadLaunchFactory} from "../src/factory/BreadLaunchFactory.sol";
import {BreadLaunchDeployer} from "../src/factory/BreadLaunchDeployer.sol";
import {IBreadLaunchFactory} from "../src/interfaces/IBreadLaunchFactory.sol";
import {BreadFeePolicySnapshot} from "../src/interfaces/IBreadFeePolicy.sol";
import {MockUSDC6} from "./helpers/MockUSDC6.sol";
import {BreadAlwaysOpenEmergencyController} from "./helpers/BreadEmergencyTestHelpers.sol";
import {BreadDay5TestWiring} from "./helpers/BreadDay5TestWiring.sol";

interface BreadFinalFillVm {
    function warp(uint256 newTimestamp) external;
}

contract BreadOpeningFinalFillTest {
    BreadFinalFillVm private constant VM =
        BreadFinalFillVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant ONE_USDC = 1_000_000;
    uint256 private constant SUPPLY = 1_000_000 ether;
    uint256 private constant PHANTOM_QUOTE = 10_000 * ONE_USDC;
    uint256 private constant GRADUATION_THRESHOLD = 100_000 * ONE_USDC;
    uint16 private constant TRADE_FEE_BPS = 100;
    uint16 private constant PROTOCOL_SHARE_BPS = 2_500;
    uint16 private constant MAX_CREATOR_TAX_BPS = 500;
    uint16 private constant CREATOR_TAX_BPS = 400;
    bytes32 private constant STACK_VERSION = keccak256("BREAD_DAY4_STACK_V1");

    address private constant PROTOCOL_RECIPIENT = address(0xA11CE);
    address private constant CREATOR_RECIPIENT = address(0xC0DE);

    struct Fixture {
        MockUSDC6 usdc;
        BreadFeePolicy policy;
        BreadFeeEscrow escrow;
        BreadLaunchFactory factory;
    }

    struct CrossingExpectation {
        uint256 sellable;
        uint256 reserved;
        uint256 netRequired;
        uint256 afterStandardRequired;
        uint256 grossRequired;
        uint256 baseFee;
        uint256 creatorTax;
        uint256 afterStandard;
        uint256 snipeTax;
        uint256 netCurveInput;
    }

    function testFinalCrossingAtElapsed0UsesTwoStageGrossUp() public {
        _assertFinalCrossingAtElapsed(0, 9_900);
    }

    function testFinalCrossingAtElapsed1UsesTwoStageGrossUp() public {
        _assertFinalCrossingAtElapsed(1, 6_336);
    }

    function testFinalCrossingAtElapsed2UsesTwoStageGrossUp() public {
        _assertFinalCrossingAtElapsed(2, 3_564);
    }

    function testFinalCrossingAtElapsed3UsesTwoStageGrossUp() public {
        _assertFinalCrossingAtElapsed(3, 1_584);
    }

    function testFinalCrossingAtElapsed4UsesTwoStageGrossUp() public {
        _assertFinalCrossingAtElapsed(4, 396);
    }

    function testFinalCrossingAtElapsed5ReducesExactlyToDay3GrossUp() public {
        _assertFinalCrossingAtElapsed(5, 0);
    }

    function testActuallyUnderfundedFinalCrossingRevertsWithoutMutation() public {
        VM.warp(20_000);
        Fixture memory f = _deployFixture();
        (address tokenAddress, address curveAddress) =
            f.factory.launchToken(_params(f.factory.previewLaunchEconomics()));
        BreadBondingCurve curve = BreadBondingCurve(curveAddress);
        BreadLaunchToken token = BreadLaunchToken(tokenAddress);
        CrossingExpectation memory e = _expectation(curve, 9_900);
        uint256 offered = _largestUnderfundedAmount(e.grossRequired, e.netRequired, 9_900);

        assert(offered < e.grossRequired);
        assert(_netCurveInput(offered, 9_900) < e.netRequired);
        f.usdc.mint(address(this), offered);
        assert(f.usdc.approve(curveAddress, offered));

        (bool ok,) = curveAddress.call(
            abi.encodeWithSelector(BreadBondingCurve.buy.selector, offered, e.sellable, address(this))
        );

        assert(!ok);
        assert(f.usdc.balanceOf(address(this)) == offered);
        assert(f.usdc.balanceOf(curveAddress) == 0);
        assert(token.balanceOf(address(this)) == 0);
        assert(token.balanceOf(curveAddress) == SUPPLY);
        assert(curve.trackedQuote() == 0);
        assert(curve.trackedTokens() == SUPPLY);
        assert(curve.quoteFeeBalance() == 0);
        assert(curve.creatorTaxBalance() == 0);
        assert(!curve.readyToGraduate());
    }

    function _assertFinalCrossingAtElapsed(uint256 elapsed, uint16 expectedSnipeBps) private {
        uint256 launchTime = 30_000 + elapsed * 100;
        VM.warp(launchTime);
        Fixture memory f = _deployFixture();
        (address tokenAddress, address curveAddress) =
            f.factory.launchToken(_params(f.factory.previewLaunchEconomics()));
        BreadBondingCurve curve = BreadBondingCurve(curveAddress);
        BreadLaunchToken token = BreadLaunchToken(tokenAddress);
        VM.warp(launchTime + elapsed);

        assert(curve.currentSnipeTaxBps() == expectedSnipeBps);
        CrossingExpectation memory e = _expectation(curve, expectedSnipeBps);
        uint256 extra = 1_000 * ONE_USDC;
        uint256 quoteIn = e.grossRequired + extra;
        f.usdc.mint(address(this), quoteIn);
        assert(f.usdc.approve(curveAddress, quoteIn));

        uint256 tokensOut = curve.buy(quoteIn, e.sellable, address(this));

        assert(tokensOut == e.sellable);
        assert(token.balanceOf(address(this)) == e.sellable);
        assert(curve.trackedTokens() == e.reserved);
        assert(curve.readyToGraduate());
        assert(curve.trackedQuote() == e.grossRequired);
        assert(f.usdc.balanceOf(address(this)) == extra);
        assert(f.usdc.balanceOf(curveAddress) == e.grossRequired);
        assert(curve.quoteFeeBalance() == e.baseFee + e.snipeTax);
        assert(curve.creatorTaxBalance() == e.creatorTax);
        assert(curve.realQuoteReserve() == e.netCurveInput);
        assert(e.netCurveInput >= e.netRequired);
    }

    function _expectation(BreadBondingCurve curve, uint16 snipeBps)
        private
        view
        returns (CrossingExpectation memory e)
    {
        e.reserved = curve.reservedTokens();
        e.sellable = curve.sellableTokens();
        e.netRequired = _amountIn(e.sellable, PHANTOM_QUOTE, SUPPLY);
        e.afterStandardRequired = _ceilMulDiv(e.netRequired, 10_000, 10_000 - uint256(snipeBps));
        e.grossRequired = _ceilMulDiv(
            e.afterStandardRequired,
            10_000,
            10_000 - TRADE_FEE_BPS - CREATOR_TAX_BPS
        );
        e.baseFee = e.grossRequired * TRADE_FEE_BPS / 10_000;
        e.creatorTax = e.grossRequired * CREATOR_TAX_BPS / 10_000;
        e.afterStandard = e.grossRequired - e.baseFee - e.creatorTax;
        e.snipeTax = e.afterStandard * snipeBps / 10_000;
        e.netCurveInput = e.afterStandard - e.snipeTax;
    }

    function _largestUnderfundedAmount(uint256 knownSufficient, uint256 netRequired, uint16 snipeBps)
        private
        pure
        returns (uint256 offered)
    {
        uint256 low;
        uint256 high = knownSufficient;
        while (low + 1 < high) {
            uint256 middle = low + (high - low) / 2;
            if (_netCurveInput(middle, snipeBps) < netRequired) {
                low = middle;
            } else {
                high = middle;
            }
        }
        offered = low;
    }

    function _netCurveInput(uint256 spent, uint16 snipeBps) private pure returns (uint256) {
        uint256 baseFee = spent * TRADE_FEE_BPS / 10_000;
        uint256 creatorTax = spent * CREATOR_TAX_BPS / 10_000;
        uint256 afterStandard = spent - baseFee - creatorTax;
        uint256 snipeTax = afterStandard * snipeBps / 10_000;
        return afterStandard - snipeTax;
    }

    function _deployFixture() private returns (Fixture memory f) {
        f.usdc = new MockUSDC6();
        BreadFeePolicySnapshot memory snapshot = BreadFeePolicySnapshot({
            protocolFeeRecipient: PROTOCOL_RECIPIENT,
            tradeFeeBps: TRADE_FEE_BPS,
            protocolFeeShareBps: PROTOCOL_SHARE_BPS,
            maxCreatorTaxBps: MAX_CREATOR_TAX_BPS
        });
        f.policy = new BreadFeePolicy(address(this), snapshot, address(this));
        f.escrow = new BreadFeeEscrow(address(f.usdc), address(this));
        BreadAlwaysOpenEmergencyController emergencyController = new BreadAlwaysOpenEmergencyController();
        IBreadLaunchFactory.LaunchConfig memory config = IBreadLaunchFactory.LaunchConfig({
            supply: SUPPLY,
            phantomQuote: PHANTOM_QUOTE,
            graduationThreshold: GRADUATION_THRESHOLD,
            launchFeeUsdc: 0,
            graduationAdapter: address(0),
            graduationConfigHash: bytes32(0),
            enabled: false
        });
        f.factory = new BreadLaunchFactory(
            address(this), address(f.usdc), address(f.policy), address(f.escrow), address(emergencyController), config, STACK_VERSION
        );
        BreadLaunchDeployer deployer = new BreadLaunchDeployer(address(f.factory));
        f.factory.setLaunchDeployer(deployer);
        BreadDay5TestWiring.wire(f.factory, address(f.usdc), f.escrow, address(emergencyController));
    }

    function _params(bytes32 expectedEconomics)
        private
        pure
        returns (IBreadLaunchFactory.LaunchParams memory p)
    {
        p.name = "Bread Final Fill";
        p.symbol = "BFF";
        p.logo = "";
        p.description = "";
        p.twitter = "";
        p.telegram = "";
        p.discord = "";
        p.website = "";
        p.farcaster = "";
        p.creatorFeeRecipient = CREATOR_RECIPIENT;
        p.creatorTaxBps = CREATOR_TAX_BPS;
        p.expectedEconomics = expectedEconomics;
    }

    function _amountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut)
        private
        pure
        returns (uint256)
    {
        return (amountOut * reserveIn * 10_000) / ((reserveOut - amountOut) * 10_000) + 1;
    }

    function _ceilMulDiv(uint256 x, uint256 y, uint256 denominator) private pure returns (uint256) {
        uint256 product = x * y;
        return product / denominator + (product % denominator == 0 ? 0 : 1);
    }
}
