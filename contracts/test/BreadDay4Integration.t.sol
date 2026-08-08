// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../src/core/BreadBondingCurve.sol";
import {BreadLaunchToken} from "../src/BreadLaunchToken.sol";
import {IBreadEmergencyController} from "../src/interfaces/IBreadEmergencyController.sol";
import {IBreadLaunchFactory} from "../src/interfaces/IBreadLaunchFactory.sol";
import {BreadDay4Fixture} from "./helpers/BreadDay4Fixture.sol";

contract BreadDay4IntegrationTest is BreadDay4Fixture {
    function testRealVerticalLaunchBuyOpeningTaxSweepAndClaimsReconcile() public {
        Day4Fixture memory f = _deployDay4Fixture(DAY4_LAUNCH_FEE);
        f.escrow.setAuthorizedCreditor(address(f.factory), true);

        uint256 initialQuote = 500 * ONE_USDC;
        uint256 ordinaryQuote = 500 * ONE_USDC;
        uint256 totalFunding = DAY4_LAUNCH_FEE + initialQuote + ordinaryQuote;
        f.usdc.mint(address(this), totalFunding);
        assert(f.usdc.approve(address(f.factory), DAY4_LAUNCH_FEE + initialQuote));

        (address tokenAddress, address curveAddress,) = IBreadLaunchFactory(address(f.factory)).launchTokenAndBuy(
            _day4Params(f.factory.previewLaunchEconomics()), initialQuote, 0, address(this)
        );
        BreadBondingCurve curve = BreadBondingCurve(curveAddress);
        BreadLaunchToken token = BreadLaunchToken(tokenAddress);

        uint256 firstBase = initialQuote * DAY4_TRADE_FEE_BPS / 10_000;
        uint256 firstCreatorTax = initialQuote * DAY4_CREATOR_TAX_BPS / 10_000;
        assert(curve.launchBuyExemptionConsumed());
        assert(curve.quoteFeeBalance() == firstBase);
        assert(curve.creatorTaxBalance() == firstCreatorTax);
        assert(f.escrow.balanceOf(DAY4_PROTOCOL_RECIPIENT) == DAY4_LAUNCH_FEE);
        assert(f.usdc.balanceOf(address(f.factory)) == 0);

        assert(f.usdc.approve(curveAddress, ordinaryQuote));
        uint256 secondBase = ordinaryQuote * DAY4_TRADE_FEE_BPS / 10_000;
        uint256 secondCreatorTax = ordinaryQuote * DAY4_CREATOR_TAX_BPS / 10_000;
        uint256 afterStandard = ordinaryQuote - secondBase - secondCreatorTax;
        uint256 openingTax = afterStandard * 9_900 / 10_000;
        curve.buy(ordinaryQuote, 0, address(this));

        assert(curve.quoteFeeBalance() == firstBase + secondBase + openingTax);
        assert(curve.creatorTaxBalance() == firstCreatorTax + secondCreatorTax);
        assert(token.balanceOf(address(this)) != 0);

        f.escrow.setAuthorizedCreditor(curveAddress, true);
        curve.sweepFees();

        uint256 baseBucket = firstBase + secondBase + openingTax;
        uint256 protocolTradeShare = baseBucket * DAY4_PROTOCOL_SHARE_BPS / 10_000;
        uint256 creatorTradeShare = baseBucket - protocolTradeShare + firstCreatorTax + secondCreatorTax;
        assert(f.escrow.balanceOf(DAY4_PROTOCOL_RECIPIENT) == DAY4_LAUNCH_FEE + protocolTradeShare);
        assert(f.escrow.balanceOf(address(this)) == creatorTradeShare);
        assert(
            f.escrow.totalOutstanding()
                == DAY4_LAUNCH_FEE + baseBucket + firstCreatorTax + secondCreatorTax
        );

        uint256 creatorClaim = f.escrow.claim();
        assert(creatorClaim == creatorTradeShare);
        assert(f.escrow.balanceOf(address(this)) == 0);
        assert(f.escrow.totalOutstanding() == DAY4_LAUNCH_FEE + protocolTradeShare);
    }

    function testRealVerticalRequiresExplicitFactoryAndCurveCreditAuthorization() public {
        Day4Fixture memory f = _deployDay4Fixture(DAY4_LAUNCH_FEE);
        uint256 initialQuote = 100 * ONE_USDC;
        uint256 totalFunding = DAY4_LAUNCH_FEE + initialQuote;
        f.usdc.mint(address(this), totalFunding);
        assert(f.usdc.approve(address(f.factory), totalFunding));

        (bool launchOk,) = address(f.factory).call(
            abi.encodeCall(
                IBreadLaunchFactory.launchTokenAndBuy,
                (_day4Params(f.factory.previewLaunchEconomics()), initialQuote, 0, address(this))
            )
        );
        assert(!launchOk);
        assert(f.usdc.balanceOf(address(this)) == totalFunding);
        assert(f.escrow.totalOutstanding() == 0);

        f.escrow.setAuthorizedCreditor(address(f.factory), true);
        (address tokenAddress, address curveAddress,) = IBreadLaunchFactory(address(f.factory)).launchTokenAndBuy(
            _day4Params(f.factory.previewLaunchEconomics()), initialQuote, 0, address(this)
        );
        tokenAddress;
        BreadBondingCurve curve = BreadBondingCurve(curveAddress);

        (bool sweepOk,) = address(curve).call(abi.encodeWithSelector(BreadBondingCurve.sweepFees.selector));
        assert(!sweepOk);
        assert(curve.quoteFeeBalance() + curve.creatorTaxBalance() != 0);

        f.escrow.setAuthorizedCreditor(curveAddress, true);
        curve.sweepFees();
        assert(curve.quoteFeeBalance() == 0);
        assert(curve.creatorTaxBalance() == 0);
    }

    function testRealVerticalEmergencyTransitionsPreserveLaunchAndFinancialSnapshots() public {
        Day4Fixture memory f = _deployDay4Fixture(0);
        uint256 quoteIn = 1_000 * ONE_USDC;
        f.usdc.mint(address(this), quoteIn);
        assert(f.usdc.approve(address(f.factory), quoteIn));
        (address tokenAddress, address curveAddress,) = IBreadLaunchFactory(address(f.factory)).launchTokenAndBuy(
            _day4Params(f.factory.previewLaunchEconomics()), quoteIn, 0, address(this)
        );
        BreadBondingCurve curve = BreadBondingCurve(curveAddress);

        IBreadLaunchFactory.LaunchRecord memory beforeRecord = f.factory.getLaunch(tokenAddress);
        uint256 trackedQuoteBefore = curve.trackedQuote();
        uint256 trackedTokensBefore = curve.trackedTokens();
        uint256 feeBefore = curve.quoteFeeBalance();
        uint256 taxBefore = curve.creatorTaxBalance();

        f.emergencyController.setRestrictionMode(IBreadEmergencyController.RestrictionMode.NO_NEW_LAUNCHES);
        f.emergencyController.setRestrictionMode(IBreadEmergencyController.RestrictionMode.BUY_PAUSED);
        f.emergencyController.setRestrictionMode(IBreadEmergencyController.RestrictionMode.TRADING_PAUSED);
        f.emergencyController.setGraduationPaused(true);
        f.emergencyController.setRestrictionMode(IBreadEmergencyController.RestrictionMode.NORMAL);
        f.emergencyController.setGraduationPaused(false);

        IBreadLaunchFactory.LaunchRecord memory afterRecord = f.factory.getLaunch(tokenAddress);
        assert(afterRecord.economicsDigest == beforeRecord.economicsDigest);
        assert(afterRecord.launchTimestamp == beforeRecord.launchTimestamp);
        assert(afterRecord.launchTimestamp == curve.launchTimestamp());
        assert(curve.trackedQuote() == trackedQuoteBefore);
        assert(curve.trackedTokens() == trackedTokensBefore);
        assert(curve.quoteFeeBalance() == feeBefore);
        assert(curve.creatorTaxBalance() == taxBefore);
        assert(curve.tradeFeeBps() == DAY4_TRADE_FEE_BPS);
        assert(curve.protocolFeeShareBps() == DAY4_PROTOCOL_SHARE_BPS);
        assert(curve.creatorTaxBps() == DAY4_CREATOR_TAX_BPS);
        assert(curve.phantomQuote() == DAY4_PHANTOM_QUOTE);
        assert(curve.graduationThreshold() == DAY4_GRADUATION_THRESHOLD);
    }
}
