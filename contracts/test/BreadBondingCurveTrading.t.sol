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

    function testOrdinaryBuyUsesQuoteLegFeesAndTrackedReserves() public {
        (
            MockUSDC6 usdc,
            BreadFeePolicy policy,
            BreadFeeEscrow escrow,
            BreadBondingCurve curve,
            BreadLaunchToken token
        ) = _deployFixture();
        policy;
        escrow;

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

    function _deployFixture()
        private
        returns (
            MockUSDC6 usdc,
            BreadFeePolicy policy,
            BreadFeeEscrow escrow,
            BreadBondingCurve curve,
            BreadLaunchToken token
        )
    {
        usdc = new MockUSDC6();
        BreadFeePolicySnapshot memory snapshot = BreadFeePolicySnapshot({
            protocolFeeRecipient: address(0xA11CE),
            tradeFeeBps: TRADE_FEE_BPS,
            protocolFeeShareBps: 2_500,
            maxCreatorTaxBps: 500
        });
        policy = new BreadFeePolicy(address(this), snapshot, address(0xB0B));
        escrow = new BreadFeeEscrow(address(usdc), address(this));
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
