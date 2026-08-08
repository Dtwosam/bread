// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../src/core/BreadBondingCurve.sol";
import {BreadLaunchToken} from "../src/BreadLaunchToken.sol";
import {BreadFeeEscrow} from "../src/fees/BreadFeeEscrow.sol";
import {BreadFeePolicy} from "../src/fees/BreadFeePolicy.sol";
import {BreadFeePolicySnapshot} from "../src/interfaces/IBreadFeePolicy.sol";
import {MockUSDC6} from "./helpers/MockUSDC6.sol";

contract BreadBondingCurveTradingTest {
    uint256 private constant ONE_USDC = 1_000_000;
    uint256 private constant TOKEN_SUPPLY = 1_000_000 ether;
    uint256 private constant PHANTOM_QUOTE = 10_000 * ONE_USDC;
    uint256 private constant GRADUATION_THRESHOLD = 100_000 * ONE_USDC;
    uint16 private constant TRADE_FEE_BPS = 100;
    uint16 private constant CREATOR_TAX_BPS = 500;

    struct SellExpectations {
        uint256 quoteIn;
        uint256 buyFee;
        uint256 buyTax;
        uint256 buyNetQuote;
        uint256 boughtTokens;
        uint256 tokensIn;
        uint256 quoteReserveBeforeSell;
        uint256 tokenReserveBeforeSell;
        uint256 grossQuoteOut;
        uint256 sellFee;
        uint256 sellTax;
        uint256 expectedQuoteOut;
    }

    function testOrdinaryBuyUsesQuoteLegFeesAndTrackedReserves() public {
        (MockUSDC6 usdc, BreadBondingCurve curve, BreadLaunchToken token) = _deployFixture();

        uint256 quoteIn = 1_000 * ONE_USDC;
        uint256 fee = quoteIn * TRADE_FEE_BPS / 10_000;
        uint256 tax = quoteIn * CREATOR_TAX_BPS / 10_000;
        uint256 netQuote = quoteIn - fee - tax;
        uint256 expectedTokensOut = _amountOut(netQuote, PHANTOM_QUOTE, TOKEN_SUPPLY);

        usdc.mint(address(this), quoteIn);
        assert(usdc.approve(address(curve), quoteIn));

        uint256 tokensOut = curve.buy(quoteIn, expectedTokensOut, address(this));

        assert(tokensOut == expectedTokensOut);
        assert(usdc.balanceOf(address(this)) == 0);
        assert(usdc.balanceOf(address(curve)) == quoteIn);
        assert(token.balanceOf(address(this)) == expectedTokensOut);
        assert(curve.quoteFeeBalance() == fee);
        assert(curve.creatorTaxBalance() == tax);
        assert(curve.trackedQuote() == quoteIn);
        assert(curve.trackedTokens() == TOKEN_SUPPLY - expectedTokensOut);
        assert(curve.realQuoteReserve() == netQuote);
        (uint256 quoteReserve, uint256 tokenReserve) = curve.getReserves();
        assert(quoteReserve == PHANTOM_QUOTE + netQuote);
        assert(tokenReserve == TOKEN_SUPPLY - expectedTokensOut);
    }

    function testOrdinarySellChargesQuoteLegFeesAndReturnsNetQuote() public {
        (MockUSDC6 usdc, BreadBondingCurve curve, BreadLaunchToken token) = _deployFixture();
        SellExpectations memory e;

        e.quoteIn = 2_000 * ONE_USDC;
        e.buyFee = e.quoteIn * TRADE_FEE_BPS / 10_000;
        e.buyTax = e.quoteIn * CREATOR_TAX_BPS / 10_000;
        e.buyNetQuote = e.quoteIn - e.buyFee - e.buyTax;
        e.boughtTokens = _amountOut(e.buyNetQuote, PHANTOM_QUOTE, TOKEN_SUPPLY);

        usdc.mint(address(this), e.quoteIn);
        assert(usdc.approve(address(curve), e.quoteIn));
        curve.buy(e.quoteIn, e.boughtTokens, address(this));

        e.tokensIn = e.boughtTokens / 4;
        e.quoteReserveBeforeSell = PHANTOM_QUOTE + e.buyNetQuote;
        e.tokenReserveBeforeSell = TOKEN_SUPPLY - e.boughtTokens;
        e.grossQuoteOut = _amountOut(e.tokensIn, e.tokenReserveBeforeSell, e.quoteReserveBeforeSell);
        e.sellFee = e.grossQuoteOut * TRADE_FEE_BPS / 10_000;
        e.sellTax = e.grossQuoteOut * CREATOR_TAX_BPS / 10_000;
        e.expectedQuoteOut = e.grossQuoteOut - e.sellFee - e.sellTax;

        assert(token.approve(address(curve), e.tokensIn));
        uint256 quoteOut = curve.sell(e.tokensIn, e.expectedQuoteOut, address(this));

        assert(quoteOut == e.expectedQuoteOut);
        assert(usdc.balanceOf(address(this)) == e.expectedQuoteOut);
        assert(usdc.balanceOf(address(curve)) == e.quoteIn - e.expectedQuoteOut);
        assert(token.balanceOf(address(this)) == e.boughtTokens - e.tokensIn);
        assert(curve.quoteFeeBalance() == e.buyFee + e.sellFee);
        assert(curve.creatorTaxBalance() == e.buyTax + e.sellTax);
        assert(curve.trackedQuote() == e.quoteIn - e.expectedQuoteOut);
        assert(curve.trackedTokens() == TOKEN_SUPPLY - e.boughtTokens + e.tokensIn);
        (uint256 quoteReserveAfter, uint256 tokenReserveAfter) = curve.getReserves();
        assert(quoteReserveAfter == e.quoteReserveBeforeSell - e.grossQuoteOut);
        assert(tokenReserveAfter == e.tokenReserveBeforeSell + e.tokensIn);
    }

    function _deployFixture() private returns (MockUSDC6 usdc, BreadBondingCurve curve, BreadLaunchToken token) {
        usdc = new MockUSDC6();
        BreadFeePolicySnapshot memory snapshot = BreadFeePolicySnapshot({
            protocolFeeRecipient: address(0xA11CE),
            tradeFeeBps: TRADE_FEE_BPS,
            protocolFeeShareBps: 2_500,
            maxCreatorTaxBps: 500
        });
        BreadFeePolicy policy = new BreadFeePolicy(address(this), snapshot, address(0xB0B));
        BreadFeeEscrow escrow = new BreadFeeEscrow(address(usdc), address(this));
        curve = new BreadBondingCurve(
            address(usdc),
            address(this),
            address(this),
            address(policy),
            address(escrow),
            PHANTOM_QUOTE,
            CREATOR_TAX_BPS,
            GRADUATION_THRESHOLD
        );

        BreadLaunchToken.Socials memory socials;
        token = new BreadLaunchToken(
            "Bread Test",
            "BREAD",
            "",
            "",
            socials,
            address(this),
            address(curve),
            address(this),
            TOKEN_SUPPLY
        );
        curve.initialize(address(token));
    }

    function _amountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
        private
        pure
        returns (uint256)
    {
        uint256 numerator = amountIn * reserveOut;
        uint256 denominator = reserveIn + amountIn;
        return numerator / denominator;
    }
}
