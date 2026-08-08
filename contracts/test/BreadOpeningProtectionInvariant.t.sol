// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../src/core/BreadBondingCurve.sol";
import {BreadLaunchToken} from "../src/BreadLaunchToken.sol";
import {IBreadLaunchFactory} from "../src/interfaces/IBreadLaunchFactory.sol";
import {BreadDay4Fixture} from "./helpers/BreadDay4Fixture.sol";

interface BreadOpeningInvariantVm {
    function warp(uint256 newTimestamp) external;
}

contract BreadOpeningProtectionInvariantTest is BreadDay4Fixture {
    BreadOpeningInvariantVm private constant VM =
        BreadOpeningInvariantVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function testFuzz_INV040_INV041SnipeTaxBoundMonotonicAndExactTerminal(uint8 rawA, uint8 rawB) public {
        VM.warp(100_000);
        Day4Fixture memory f = _deployDay4Fixture(0);
        (, address curveAddress) = f.factory.launchToken(_day4Params(f.factory.previewLaunchEconomics()));
        BreadBondingCurve curve = BreadBondingCurve(curveAddress);
        uint256 launchedAt = curve.launchTimestamp();

        uint256 a = uint256(rawA) % 9;
        uint256 b = uint256(rawB) % 9;
        if (a > b) (a, b) = (b, a);

        VM.warp(launchedAt + a);
        uint16 taxA = curve.currentSnipeTaxBps();
        VM.warp(launchedAt + b);
        uint16 taxB = curve.currentSnipeTaxBps();

        assert(taxA <= 9_900);
        assert(taxB <= 9_900);
        assert(taxA >= taxB);
        if (a >= 5) assert(taxA == 0);
        if (b >= 5) assert(taxB == 0);
    }

    function testFuzz_INV042SellNeverAddsOpeningTax(uint64 rawQuote, uint8 rawSellDivisor) public {
        VM.warp(200_000);
        Day4Fixture memory f = _deployDay4Fixture(0);
        (address tokenAddress, address curveAddress) =
            f.factory.launchToken(_day4Params(f.factory.previewLaunchEconomics()));
        BreadBondingCurve curve = BreadBondingCurve(curveAddress);
        BreadLaunchToken token = BreadLaunchToken(tokenAddress);

        uint256 quoteIn = 100 * ONE_USDC + (uint256(rawQuote) % (400 * ONE_USDC));
        f.usdc.mint(address(this), quoteIn);
        assert(f.usdc.approve(curveAddress, quoteIn));
        uint256 bought = curve.buy(quoteIn, 0, address(this));
        assert(bought != 0);

        uint256 quoteFeeBefore = curve.quoteFeeBalance();
        uint256 creatorTaxBefore = curve.creatorTaxBalance();
        uint256 divisor = 2 + (uint256(rawSellDivisor) % 8);
        uint256 tokensIn = bought / divisor;
        assert(tokensIn != 0);
        assert(token.approve(curveAddress, tokensIn));
        (uint256 quoteReserveBefore, uint256 tokenReserveBefore) = curve.getReserves();
        uint256 grossQuoteOut = tokensIn * quoteReserveBefore / (tokenReserveBefore + tokensIn);
        uint256 sellBaseFee = grossQuoteOut * DAY4_TRADE_FEE_BPS / 10_000;
        uint256 sellCreatorTax = grossQuoteOut * DAY4_CREATOR_TAX_BPS / 10_000;

        curve.sell(tokensIn, 0, address(this));

        assert(curve.quoteFeeBalance() == quoteFeeBefore + sellBaseFee);
        assert(curve.creatorTaxBalance() == creatorTaxBefore + sellCreatorTax);
    }

    function test_INV043OnlyFactoryInitialBuyIsExemptAndCannotReplay() public {
        VM.warp(300_000);
        Day4Fixture memory f = _deployDay4Fixture(0);
        uint256 firstQuote = 500 * ONE_USDC;
        uint256 secondQuote = 500 * ONE_USDC;
        f.usdc.mint(address(this), firstQuote + secondQuote);
        assert(f.usdc.approve(address(f.factory), firstQuote));

        (, address curveAddress,) = IBreadLaunchFactory(address(f.factory)).launchTokenAndBuy(
            _day4Params(f.factory.previewLaunchEconomics()), firstQuote, 0, address(this)
        );
        BreadBondingCurve curve = BreadBondingCurve(curveAddress);
        assert(curve.launchBuyExemptionConsumed());
        uint256 quoteFeeAfterExempt = curve.quoteFeeBalance();

        assert(f.usdc.approve(curveAddress, secondQuote));
        curve.buy(secondQuote, 0, address(this));
        assert(curve.quoteFeeBalance() > quoteFeeAfterExempt + secondQuote * DAY4_TRADE_FEE_BPS / 10_000);

        (bool replayOk,) = curveAddress.call(
            abi.encodeWithSelector(BreadBondingCurve.buyForLaunch.selector, ONE_USDC, 0, address(this))
        );
        assert(!replayOk);
    }

    function testFuzz_INV044OpeningFeesRemainCanonicalThroughSweepAndClaims(uint64 rawQuote, uint8 rawElapsed) public {
        VM.warp(400_000);
        Day4Fixture memory f = _deployDay4Fixture(0);
        (, address curveAddress) = f.factory.launchToken(_day4Params(f.factory.previewLaunchEconomics()));
        BreadBondingCurve curve = BreadBondingCurve(curveAddress);
        uint256 elapsed = uint256(rawElapsed) % 5;
        VM.warp(uint256(curve.launchTimestamp()) + elapsed);

        uint256 quoteIn = 100 * ONE_USDC + (uint256(rawQuote) % (400 * ONE_USDC));
        f.usdc.mint(address(this), quoteIn);
        assert(f.usdc.approve(curveAddress, quoteIn));
        curve.buy(quoteIn, 0, address(this));

        uint256 pendingBase = curve.quoteFeeBalance();
        uint256 pendingCreatorTax = curve.creatorTaxBalance();
        assert(pendingBase >= quoteIn * DAY4_TRADE_FEE_BPS / 10_000);
        assert(pendingCreatorTax == quoteIn * DAY4_CREATOR_TAX_BPS / 10_000);

        f.escrow.setAuthorizedCreditor(curveAddress, true);
        curve.sweepFees();

        assert(curve.quoteFeeBalance() == 0);
        assert(curve.creatorTaxBalance() == 0);
        assert(f.escrow.totalOutstanding() == pendingBase + pendingCreatorTax);
        uint256 protocolClaim = f.escrow.balanceOf(DAY4_PROTOCOL_RECIPIENT);
        uint256 creatorClaim = f.escrow.balanceOf(address(this));
        assert(protocolClaim + creatorClaim == pendingBase + pendingCreatorTax);
        assert(creatorClaim != 0);
        f.escrow.claim();
        assert(f.escrow.balanceOf(address(this)) == 0);
        assert(f.escrow.totalOutstanding() == protocolClaim);
    }
}
