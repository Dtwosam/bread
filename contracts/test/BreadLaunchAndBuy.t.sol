// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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
import {BreadTestTime} from "./helpers/BreadTestTime.sol";

contract BreadLaunchAndBuyTest {
    uint256 private constant ONE_USDC = 1_000_000;
    uint256 private constant SUPPLY = 1_000_000 ether;
    uint256 private constant PHANTOM_QUOTE = 10_000 * ONE_USDC;
    uint256 private constant GRADUATION_THRESHOLD = 100_000 * ONE_USDC;
    uint256 private constant LAUNCH_FEE = 10 * ONE_USDC;
    uint16 private constant TRADE_FEE_BPS = 100;
    uint16 private constant PROTOCOL_SHARE_BPS = 2_500;
    uint16 private constant MAX_CREATOR_TAX_BPS = 500;
    uint16 private constant CREATOR_TAX_BPS = 400;
    bytes32 private constant STACK_VERSION = keccak256("BREAD_DAY4_STACK_V1");

    address private constant PROTOCOL_RECIPIENT = address(0xA11CE);
    address private constant CREATOR_RECIPIENT = address(0xC0DE);
    address private constant BUY_RECIPIENT = address(0xB0B);

    struct Fixture {
        MockUSDC6 usdc;
        BreadFeePolicy policy;
        BreadFeeEscrow escrow;
        BreadLaunchFactory factory;
    }

    function testLaunchAndBuyAtomicallyDeliversCanonicalCurveOutput() public {
        Fixture memory f = _deployFixture(LAUNCH_FEE);
        f.escrow.setAuthorizedCreditor(address(f.factory), true);
        uint256 quoteIn = 1_000 * ONE_USDC;
        uint256 totalIn = LAUNCH_FEE + quoteIn;
        f.usdc.mint(address(this), totalIn);
        assert(f.usdc.approve(address(f.factory), totalIn));

        uint256 fee = quoteIn * TRADE_FEE_BPS / 10_000;
        uint256 tax = quoteIn * CREATOR_TAX_BPS / 10_000;
        uint256 expectedTokens = _amountOut(quoteIn - fee - tax, PHANTOM_QUOTE, SUPPLY);

        (address token, address curve, uint256 tokensOut) = IBreadLaunchFactory(address(f.factory)).launchTokenAndBuy(
            _params(f.factory.previewLaunchEconomics()), quoteIn, expectedTokens, BUY_RECIPIENT
        );

        assert(tokensOut == expectedTokens);
        assert(BreadLaunchToken(token).balanceOf(BUY_RECIPIENT) == expectedTokens);
        assert(BreadBondingCurve(curve).trackedQuote() == quoteIn);
        assert(BreadBondingCurve(curve).quoteFeeBalance() == fee);
        assert(BreadBondingCurve(curve).creatorTaxBalance() == tax);
        assert(f.usdc.balanceOf(address(f.factory)) == 0);
        assert(f.usdc.allowance(address(f.factory), curve) == 0);
        assert(f.escrow.balanceOf(PROTOCOL_RECIPIENT) == LAUNCH_FEE);
        assert(f.factory.getLaunch(token).curve == curve);
    }

    function testLaunchAndBuyRejectsZeroQuoteAndZeroRecipientWithoutCustodyMutation() public {
        Fixture memory f = _deployFixture(0);
        IBreadLaunchFactory.LaunchParams memory p = _params(f.factory.previewLaunchEconomics());

        (bool zeroQuoteOk,) = address(f.factory).call(
            abi.encodeCall(IBreadLaunchFactory.launchTokenAndBuy, (p, 0, 0, BUY_RECIPIENT))
        );
        (bool zeroRecipientOk,) = address(f.factory).call(
            abi.encodeCall(IBreadLaunchFactory.launchTokenAndBuy, (p, ONE_USDC, 0, address(0)))
        );

        assert(!zeroQuoteOk);
        assert(!zeroRecipientOk);
        assert(f.usdc.balanceOf(address(f.factory)) == 0);
        assert(f.escrow.totalOutstanding() == 0);
    }

    function testLaunchAndBuySlippageFailureRollsBackLaunchFeeCustodyAndDeploymentEffects() public {
        Fixture memory f = _deployFixture(LAUNCH_FEE);
        f.escrow.setAuthorizedCreditor(address(f.factory), true);
        uint256 quoteIn = 1_000 * ONE_USDC;
        uint256 totalIn = LAUNCH_FEE + quoteIn;
        f.usdc.mint(address(this), totalIn);
        assert(f.usdc.approve(address(f.factory), totalIn));

        uint256 fee = quoteIn * TRADE_FEE_BPS / 10_000;
        uint256 tax = quoteIn * CREATOR_TAX_BPS / 10_000;
        uint256 expectedTokens = _amountOut(quoteIn - fee - tax, PHANTOM_QUOTE, SUPPLY);
        IBreadLaunchFactory.LaunchParams memory p = _params(f.factory.previewLaunchEconomics());

        (bool ok,) = address(f.factory).call(
            abi.encodeCall(
                IBreadLaunchFactory.launchTokenAndBuy,
                (p, quoteIn, expectedTokens + 1, BUY_RECIPIENT)
            )
        );

        assert(!ok);
        assert(f.usdc.balanceOf(address(this)) == totalIn);
        assert(f.usdc.balanceOf(address(f.factory)) == 0);
        assert(f.usdc.balanceOf(address(f.escrow)) == 0);
        assert(f.escrow.balanceOf(PROTOCOL_RECIPIENT) == 0);
        assert(f.escrow.totalOutstanding() == 0);
    }

    function testLaunchAndBuyFinalCrossingFillReturnsExactCurveRefundToOriginalCaller() public {
        Fixture memory f = _deployFixture(LAUNCH_FEE);
        f.escrow.setAuthorizedCreditor(address(f.factory), true);

        uint256 reserved = SUPPLY * PHANTOM_QUOTE / (PHANTOM_QUOTE + GRADUATION_THRESHOLD);
        uint256 sellable = SUPPLY - reserved;
        uint256 netRequired = _amountIn(sellable, PHANTOM_QUOTE, SUPPLY);
        uint256 spent = _ceilMulDiv(
            netRequired,
            10_000,
            10_000 - TRADE_FEE_BPS - CREATOR_TAX_BPS
        );
        uint256 extra = 1_000 * ONE_USDC;
        uint256 quoteIn = spent + extra;
        uint256 totalIn = LAUNCH_FEE + quoteIn;
        f.usdc.mint(address(this), totalIn);
        assert(f.usdc.approve(address(f.factory), totalIn));

        (address token, address curve, uint256 tokensOut) = IBreadLaunchFactory(address(f.factory)).launchTokenAndBuy(
            _params(f.factory.previewLaunchEconomics()), quoteIn, sellable, BUY_RECIPIENT
        );

        assert(tokensOut == sellable);
        assert(BreadLaunchToken(token).balanceOf(BUY_RECIPIENT) == sellable);
        assert(BreadBondingCurve(curve).trackedTokens() == reserved);
        assert(BreadBondingCurve(curve).trackedQuote() == spent);
        assert(BreadBondingCurve(curve).readyToGraduate());
        assert(f.usdc.balanceOf(address(this)) == extra);
        assert(f.usdc.balanceOf(address(f.factory)) == 0);
        assert(f.usdc.allowance(address(f.factory), curve) == 0);
        assert(f.escrow.balanceOf(PROTOCOL_RECIPIENT) == LAUNCH_FEE);
    }

    function testCurveLaunchBuyEntryRejectsNonFactoryCaller() public {
        Fixture memory f = _deployFixture(0);
        (address token, address curve) = f.factory.launchToken(_params(f.factory.previewLaunchEconomics()));
        token;
        f.usdc.mint(address(this), ONE_USDC);
        assert(f.usdc.approve(curve, ONE_USDC));

        (bool ok,) = curve.call(
            abi.encodeWithSignature("buyForLaunch(uint256,uint256,address)", ONE_USDC, 0, BUY_RECIPIENT)
        );

        assert(!ok);
        assert(f.usdc.balanceOf(address(this)) == ONE_USDC);
        assert(f.usdc.balanceOf(curve) == 0);
    }

    function testPublicBuyRemainsNumericallyIdenticalAfterLaunchBuySurfaceExists() public {
        Fixture memory f = _deployFixture(0);
        (address token, address curveAddress) = f.factory.launchToken(_params(f.factory.previewLaunchEconomics()));
        BreadBondingCurve curve = BreadBondingCurve(curveAddress);
        BreadTestTime.expireOpening(curve);
        uint256 quoteIn = 750 * ONE_USDC;
        uint256 fee = quoteIn * TRADE_FEE_BPS / 10_000;
        uint256 tax = quoteIn * CREATOR_TAX_BPS / 10_000;
        uint256 expectedTokens = _amountOut(quoteIn - fee - tax, PHANTOM_QUOTE, SUPPLY);
        f.usdc.mint(address(this), quoteIn);
        assert(f.usdc.approve(curveAddress, quoteIn));

        uint256 tokensOut = curve.buy(quoteIn, expectedTokens, address(this));

        assert(tokensOut == expectedTokens);
        assert(BreadLaunchToken(token).balanceOf(address(this)) == expectedTokens);
        assert(curve.trackedQuote() == quoteIn);
        assert(curve.quoteFeeBalance() == fee);
        assert(curve.creatorTaxBalance() == tax);
    }

    function _deployFixture(uint256 launchFee) private returns (Fixture memory f) {
        f.usdc = new MockUSDC6();
        BreadFeePolicySnapshot memory snapshot = BreadFeePolicySnapshot({
            protocolFeeRecipient: PROTOCOL_RECIPIENT,
            tradeFeeBps: TRADE_FEE_BPS,
            protocolFeeShareBps: PROTOCOL_SHARE_BPS,
            maxCreatorTaxBps: MAX_CREATOR_TAX_BPS
        });
        f.policy = new BreadFeePolicy(address(this), snapshot, address(0xB0B));
        f.escrow = new BreadFeeEscrow(address(f.usdc), address(this));
        BreadAlwaysOpenEmergencyController emergencyController = new BreadAlwaysOpenEmergencyController();
        IBreadLaunchFactory.LaunchConfig memory config = IBreadLaunchFactory.LaunchConfig({
            supply: SUPPLY,
            phantomQuote: PHANTOM_QUOTE,
            graduationThreshold: GRADUATION_THRESHOLD,
            launchFeeUsdc: launchFee,
            enabled: false
        });
        f.factory = new BreadLaunchFactory(
            address(this), address(f.usdc), address(f.policy), address(f.escrow), address(emergencyController), config, STACK_VERSION
        );
        BreadLaunchDeployer deployer = new BreadLaunchDeployer(address(f.factory));
        f.factory.setLaunchDeployer(deployer);
        config.enabled = true;
        f.factory.setLaunchConfig(config);
    }

    function _params(bytes32 expectedEconomics)
        private
        pure
        returns (IBreadLaunchFactory.LaunchParams memory p)
    {
        p.name = "Bread Launch Buy";
        p.symbol = "BLB";
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

    function _amountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
        private
        pure
        returns (uint256)
    {
        return amountIn * reserveOut / (reserveIn + amountIn);
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
