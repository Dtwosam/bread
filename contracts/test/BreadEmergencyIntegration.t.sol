// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../src/core/BreadBondingCurve.sol";
import {BreadLaunchToken} from "../src/BreadLaunchToken.sol";
import {BreadFeeEscrow} from "../src/fees/BreadFeeEscrow.sol";
import {BreadFeePolicy} from "../src/fees/BreadFeePolicy.sol";
import {BreadLaunchFactory} from "../src/factory/BreadLaunchFactory.sol";
import {BreadLaunchDeployer} from "../src/factory/BreadLaunchDeployer.sol";
import {BreadEmergencyController} from "../src/security/BreadEmergencyController.sol";
import {IBreadLaunchFactory} from "../src/interfaces/IBreadLaunchFactory.sol";
import {IBreadEmergencyController} from "../src/interfaces/IBreadEmergencyController.sol";
import {BreadFeePolicySnapshot} from "../src/interfaces/IBreadFeePolicy.sol";
import {MockUSDC6} from "./helpers/MockUSDC6.sol";
import {BreadTestTime} from "./helpers/BreadTestTime.sol";

contract BreadEmergencyIntegrationTest {
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
    address private constant GUARDIAN = address(0xBEEF);

    struct Fixture {
        MockUSDC6 usdc;
        BreadFeePolicy policy;
        BreadFeeEscrow escrow;
        BreadEmergencyController emergencyController;
        BreadLaunchFactory factory;
    }

    function testNormalModeAllowsAtomicLaunchAndExistingCurveTrade() public {
        Fixture memory f = _deployFixture();
        (address tokenAddress, address curveAddress) = _launchAndBuy(f, 1_000 * ONE_USDC);
        BreadBondingCurve curve = BreadBondingCurve(curveAddress);
        BreadLaunchToken token = BreadLaunchToken(tokenAddress);
        BreadTestTime.expireOpening(curve);

        uint256 quoteIn = 100 * ONE_USDC;
        f.usdc.mint(address(this), quoteIn);
        assert(f.usdc.approve(curveAddress, quoteIn));
        uint256 bought = curve.buy(quoteIn, 0, address(this));
        assert(bought != 0);

        uint256 tokensIn = token.balanceOf(address(this)) / 20;
        assert(tokensIn != 0);
        assert(token.approve(curveAddress, tokensIn));
        uint256 quoteOut = curve.sell(tokensIn, 0, address(this));
        assert(quoteOut != 0);
    }

    function testNoNewLaunchesBlocksLaunchButExistingCurveCanBuyAndSell() public {
        Fixture memory f = _deployFixture();
        (address tokenAddress, address curveAddress) = _launchAndBuy(f, 1_000 * ONE_USDC);
        BreadBondingCurve curve = BreadBondingCurve(curveAddress);
        BreadLaunchToken token = BreadLaunchToken(tokenAddress);
        BreadTestTime.expireOpening(curve);

        f.emergencyController.setRestrictionMode(IBreadEmergencyController.RestrictionMode.NO_NEW_LAUNCHES);

        (bool launchOk,) = address(f.factory).call(
            abi.encodeWithSelector(BreadLaunchFactory.launchToken.selector, _params(f.factory.previewLaunchEconomics()))
        );
        assert(!launchOk);

        uint256 quoteIn = 100 * ONE_USDC;
        f.usdc.mint(address(this), quoteIn);
        assert(f.usdc.approve(curveAddress, quoteIn));
        uint256 bought = curve.buy(quoteIn, 0, address(this));
        assert(bought != 0);

        uint256 tokensIn = token.balanceOf(address(this)) / 20;
        assert(tokensIn != 0);
        assert(token.approve(curveAddress, tokensIn));
        assert(curve.sell(tokensIn, 0, address(this)) != 0);
    }

    function testBuyPausedBlocksLaunchAndBuyButExistingSellStillWorks() public {
        Fixture memory f = _deployFixture();
        (address tokenAddress, address curveAddress) = _launchAndBuy(f, 1_000 * ONE_USDC);
        BreadBondingCurve curve = BreadBondingCurve(curveAddress);
        BreadLaunchToken token = BreadLaunchToken(tokenAddress);
        BreadTestTime.expireOpening(curve);

        f.emergencyController.setRestrictionMode(IBreadEmergencyController.RestrictionMode.BUY_PAUSED);

        (bool launchOk,) = address(f.factory).call(
            abi.encodeWithSelector(BreadLaunchFactory.launchToken.selector, _params(f.factory.previewLaunchEconomics()))
        );
        assert(!launchOk);

        uint256 quoteIn = 100 * ONE_USDC;
        f.usdc.mint(address(this), quoteIn);
        assert(f.usdc.approve(curveAddress, quoteIn));
        (bool buyOk,) = curveAddress.call(
            abi.encodeWithSelector(BreadBondingCurve.buy.selector, quoteIn, 0, address(this))
        );
        assert(!buyOk);
        assert(f.usdc.balanceOf(address(this)) == quoteIn);

        uint256 tokensIn = token.balanceOf(address(this)) / 20;
        assert(tokensIn != 0);
        assert(token.approve(curveAddress, tokensIn));
        assert(curve.sell(tokensIn, 0, address(this)) != 0);
    }

    function testTradingPausedBlocksLaunchBuyAndSellWithoutMutation() public {
        Fixture memory f = _deployFixture();
        (address tokenAddress, address curveAddress) = _launchAndBuy(f, 1_000 * ONE_USDC);
        BreadBondingCurve curve = BreadBondingCurve(curveAddress);
        BreadLaunchToken token = BreadLaunchToken(tokenAddress);
        BreadTestTime.expireOpening(curve);
        f.emergencyController.setRestrictionMode(IBreadEmergencyController.RestrictionMode.TRADING_PAUSED);

        uint256 trackedQuoteBefore = curve.trackedQuote();
        uint256 trackedTokensBefore = curve.trackedTokens();
        uint256 quoteFeeBefore = curve.quoteFeeBalance();
        uint256 creatorTaxBefore = curve.creatorTaxBalance();

        (bool launchOk,) = address(f.factory).call(
            abi.encodeWithSelector(BreadLaunchFactory.launchToken.selector, _params(f.factory.previewLaunchEconomics()))
        );
        assert(!launchOk);

        uint256 quoteIn = 100 * ONE_USDC;
        f.usdc.mint(address(this), quoteIn);
        assert(f.usdc.approve(curveAddress, quoteIn));
        (bool buyOk,) = curveAddress.call(
            abi.encodeWithSelector(BreadBondingCurve.buy.selector, quoteIn, 0, address(this))
        );
        assert(!buyOk);

        uint256 tokensIn = token.balanceOf(address(this)) / 20;
        assert(tokensIn != 0);
        assert(token.approve(curveAddress, tokensIn));
        (bool sellOk,) = curveAddress.call(
            abi.encodeWithSelector(BreadBondingCurve.sell.selector, tokensIn, 0, address(this))
        );
        assert(!sellOk);

        assert(curve.trackedQuote() == trackedQuoteBefore);
        assert(curve.trackedTokens() == trackedTokensBefore);
        assert(curve.quoteFeeBalance() == quoteFeeBefore);
        assert(curve.creatorTaxBalance() == creatorTaxBefore);
        assert(f.usdc.balanceOf(address(this)) == quoteIn);
    }

    function testProtocolAdminCanRestoreNormalAndExistingCurveResumes() public {
        Fixture memory f = _deployFixture();
        (, address curveAddress) = _launchAndBuy(f, 1_000 * ONE_USDC);
        BreadBondingCurve curve = BreadBondingCurve(curveAddress);
        BreadTestTime.expireOpening(curve);

        f.emergencyController.setRestrictionMode(IBreadEmergencyController.RestrictionMode.TRADING_PAUSED);
        f.emergencyController.setRestrictionMode(IBreadEmergencyController.RestrictionMode.NORMAL);

        uint256 quoteIn = 100 * ONE_USDC;
        f.usdc.mint(address(this), quoteIn);
        assert(f.usdc.approve(curveAddress, quoteIn));
        assert(curve.buy(quoteIn, 0, address(this)) != 0);
    }

    function testEmergencyTransitionsDoNotRewriteLaunchEconomicsOrCanonicalTimestamp() public {
        Fixture memory f = _deployFixture();
        (address tokenAddress, address curveAddress) = _launchAndBuy(f, 1_000 * ONE_USDC);
        BreadBondingCurve curve = BreadBondingCurve(curveAddress);
        IBreadLaunchFactory.LaunchRecord memory beforeRecord = f.factory.getLaunch(tokenAddress);
        uint16 tradeFeeBefore = curve.tradeFeeBps();
        uint16 shareBefore = curve.protocolFeeShareBps();
        uint16 creatorTaxBefore = curve.creatorTaxBps();
        uint256 phantomBefore = curve.phantomQuote();
        uint256 thresholdBefore = curve.graduationThreshold();

        f.emergencyController.setRestrictionMode(IBreadEmergencyController.RestrictionMode.NO_NEW_LAUNCHES);
        f.emergencyController.setRestrictionMode(IBreadEmergencyController.RestrictionMode.TRADING_PAUSED);
        f.emergencyController.setGraduationPaused(true);
        f.emergencyController.setRestrictionMode(IBreadEmergencyController.RestrictionMode.NORMAL);
        f.emergencyController.setGraduationPaused(false);

        IBreadLaunchFactory.LaunchRecord memory afterRecord = f.factory.getLaunch(tokenAddress);
        assert(afterRecord.economicsDigest == beforeRecord.economicsDigest);
        assert(afterRecord.launchTimestamp == beforeRecord.launchTimestamp);
        assert(afterRecord.launchTimestamp == curve.launchTimestamp());
        assert(curve.tradeFeeBps() == tradeFeeBefore);
        assert(curve.protocolFeeShareBps() == shareBefore);
        assert(curve.creatorTaxBps() == creatorTaxBefore);
        assert(curve.phantomQuote() == phantomBefore);
        assert(curve.graduationThreshold() == thresholdBefore);
    }

    function _launchAndBuy(Fixture memory f, uint256 quoteIn)
        private
        returns (address token, address curve)
    {
        f.usdc.mint(address(this), quoteIn);
        assert(f.usdc.approve(address(f.factory), quoteIn));
        (token, curve,) = IBreadLaunchFactory(address(f.factory)).launchTokenAndBuy(
            _params(f.factory.previewLaunchEconomics()), quoteIn, 0, address(this)
        );
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
        f.emergencyController = new BreadEmergencyController(address(this), GUARDIAN);
        IBreadLaunchFactory.LaunchConfig memory config = IBreadLaunchFactory.LaunchConfig({
            supply: SUPPLY,
            phantomQuote: PHANTOM_QUOTE,
            graduationThreshold: GRADUATION_THRESHOLD,
            launchFeeUsdc: 0,
            enabled: false
        });
        f.factory = new BreadLaunchFactory(
            address(this),
            address(f.usdc),
            address(f.policy),
            address(f.escrow),
            address(f.emergencyController),
            config,
            STACK_VERSION
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
        p.name = "Bread Emergency";
        p.symbol = "BERG";
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
}
