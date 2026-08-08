// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../src/core/BreadBondingCurve.sol";
import {BreadLaunchToken} from "../src/BreadLaunchToken.sol";
import {IBreadEmergencyController} from "../src/interfaces/IBreadEmergencyController.sol";
import {IBreadLaunchFactory} from "../src/interfaces/IBreadLaunchFactory.sol";
import {BreadDay4Fixture} from "./helpers/BreadDay4Fixture.sol";

contract BreadDay4IntegrationTest is BreadDay4Fixture {
    struct VerticalAccounting {
        uint256 firstBase;
        uint256 firstCreatorTax;
        uint256 secondBase;
        uint256 secondCreatorTax;
        uint256 openingTax;
        uint256 baseBucket;
        uint256 protocolTradeShare;
        uint256 creatorTradeShare;
    }

    struct Snapshot {
        bytes32 economicsDigest;
        uint64 launchTimestamp;
        uint256 trackedQuote;
        uint256 trackedTokens;
        uint256 quoteFeeBalance;
        uint256 creatorTaxBalance;
    }

    function testRealVerticalLaunchBuyOpeningTaxSweepAndClaimsReconcile() public {
        Day4Fixture memory f = _deployDay4Fixture(DAY4_LAUNCH_FEE);
        f.escrow.setAuthorizedCreditor(address(f.factory), true);

        uint256 initialQuote = 500 * ONE_USDC;
        uint256 ordinaryQuote = 500 * ONE_USDC;
        f.usdc.mint(address(this), DAY4_LAUNCH_FEE + initialQuote + ordinaryQuote);
        assert(f.usdc.approve(address(f.factory), DAY4_LAUNCH_FEE + initialQuote));

        (address tokenAddress, address curveAddress,) = IBreadLaunchFactory(address(f.factory)).launchTokenAndBuy(
            _day4Params(f.factory.previewLaunchEconomics()), initialQuote, 0, address(this)
        );
        BreadBondingCurve curve = BreadBondingCurve(curveAddress);
        VerticalAccounting memory e = _verticalAccounting(initialQuote, ordinaryQuote);

        _assertInitialExemptBuy(f, curve, e);
        _executeOrdinaryOpeningBuy(f, curve, tokenAddress, ordinaryQuote, e);
        _sweepAndAssertVerticalClaims(f, curve, e);
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
        (, address curveAddress,) = IBreadLaunchFactory(address(f.factory)).launchTokenAndBuy(
            _day4Params(f.factory.previewLaunchEconomics()), initialQuote, 0, address(this)
        );
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
        Snapshot memory beforeSnapshot = _snapshot(f, tokenAddress, curve);

        f.emergencyController.setRestrictionMode(IBreadEmergencyController.RestrictionMode.NO_NEW_LAUNCHES);
        f.emergencyController.setRestrictionMode(IBreadEmergencyController.RestrictionMode.BUY_PAUSED);
        f.emergencyController.setRestrictionMode(IBreadEmergencyController.RestrictionMode.TRADING_PAUSED);
        f.emergencyController.setGraduationPaused(true);
        f.emergencyController.setRestrictionMode(IBreadEmergencyController.RestrictionMode.NORMAL);
        f.emergencyController.setGraduationPaused(false);

        Snapshot memory afterSnapshot = _snapshot(f, tokenAddress, curve);
        assert(afterSnapshot.economicsDigest == beforeSnapshot.economicsDigest);
        assert(afterSnapshot.launchTimestamp == beforeSnapshot.launchTimestamp);
        assert(afterSnapshot.launchTimestamp == curve.launchTimestamp());
        assert(afterSnapshot.trackedQuote == beforeSnapshot.trackedQuote);
        assert(afterSnapshot.trackedTokens == beforeSnapshot.trackedTokens);
        assert(afterSnapshot.quoteFeeBalance == beforeSnapshot.quoteFeeBalance);
        assert(afterSnapshot.creatorTaxBalance == beforeSnapshot.creatorTaxBalance);
        assert(curve.tradeFeeBps() == DAY4_TRADE_FEE_BPS);
        assert(curve.protocolFeeShareBps() == DAY4_PROTOCOL_SHARE_BPS);
        assert(curve.creatorTaxBps() == DAY4_CREATOR_TAX_BPS);
        assert(curve.phantomQuote() == DAY4_PHANTOM_QUOTE);
        assert(curve.graduationThreshold() == DAY4_GRADUATION_THRESHOLD);
    }

    function _assertInitialExemptBuy(Day4Fixture memory f, BreadBondingCurve curve, VerticalAccounting memory e)
        private
        view
    {
        assert(curve.launchBuyExemptionConsumed());
        assert(curve.quoteFeeBalance() == e.firstBase);
        assert(curve.creatorTaxBalance() == e.firstCreatorTax);
        assert(f.escrow.balanceOf(DAY4_PROTOCOL_RECIPIENT) == DAY4_LAUNCH_FEE);
        assert(f.usdc.balanceOf(address(f.factory)) == 0);
    }

    function _executeOrdinaryOpeningBuy(
        Day4Fixture memory f,
        BreadBondingCurve curve,
        address tokenAddress,
        uint256 ordinaryQuote,
        VerticalAccounting memory e
    ) private {
        assert(f.usdc.approve(address(curve), ordinaryQuote));
        curve.buy(ordinaryQuote, 0, address(this));
        assert(curve.quoteFeeBalance() == e.firstBase + e.secondBase + e.openingTax);
        assert(curve.creatorTaxBalance() == e.firstCreatorTax + e.secondCreatorTax);
        assert(BreadLaunchToken(tokenAddress).balanceOf(address(this)) != 0);
    }

    function _sweepAndAssertVerticalClaims(
        Day4Fixture memory f,
        BreadBondingCurve curve,
        VerticalAccounting memory e
    ) private {
        f.escrow.setAuthorizedCreditor(address(curve), true);
        curve.sweepFees();

        assert(f.escrow.balanceOf(DAY4_PROTOCOL_RECIPIENT) == DAY4_LAUNCH_FEE + e.protocolTradeShare);
        assert(f.escrow.balanceOf(address(this)) == e.creatorTradeShare);
        assert(
            f.escrow.totalOutstanding()
                == DAY4_LAUNCH_FEE + e.baseBucket + e.firstCreatorTax + e.secondCreatorTax
        );

        uint256 creatorClaim = f.escrow.claim();
        assert(creatorClaim == e.creatorTradeShare);
        assert(f.escrow.balanceOf(address(this)) == 0);
        assert(f.escrow.totalOutstanding() == DAY4_LAUNCH_FEE + e.protocolTradeShare);
    }

    function _verticalAccounting(uint256 initialQuote, uint256 ordinaryQuote)
        private
        pure
        returns (VerticalAccounting memory e)
    {
        e.firstBase = initialQuote * DAY4_TRADE_FEE_BPS / 10_000;
        e.firstCreatorTax = initialQuote * DAY4_CREATOR_TAX_BPS / 10_000;
        e.secondBase = ordinaryQuote * DAY4_TRADE_FEE_BPS / 10_000;
        e.secondCreatorTax = ordinaryQuote * DAY4_CREATOR_TAX_BPS / 10_000;
        uint256 afterStandard = ordinaryQuote - e.secondBase - e.secondCreatorTax;
        e.openingTax = afterStandard * 9_900 / 10_000;
        e.baseBucket = e.firstBase + e.secondBase + e.openingTax;
        e.protocolTradeShare = e.baseBucket * DAY4_PROTOCOL_SHARE_BPS / 10_000;
        e.creatorTradeShare =
            e.baseBucket - e.protocolTradeShare + e.firstCreatorTax + e.secondCreatorTax;
    }

    function _snapshot(Day4Fixture memory f, address tokenAddress, BreadBondingCurve curve)
        private
        view
        returns (Snapshot memory s)
    {
        IBreadLaunchFactory.LaunchRecord memory record = f.factory.getLaunch(tokenAddress);
        s.economicsDigest = record.economicsDigest;
        s.launchTimestamp = record.launchTimestamp;
        s.trackedQuote = curve.trackedQuote();
        s.trackedTokens = curve.trackedTokens();
        s.quoteFeeBalance = curve.quoteFeeBalance();
        s.creatorTaxBalance = curve.creatorTaxBalance();
    }
}
