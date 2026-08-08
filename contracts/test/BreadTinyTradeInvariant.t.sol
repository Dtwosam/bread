// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurveMath} from "../src/libraries/BreadBondingCurveMath.sol";

contract BreadTinyTradeInvariantTest {
    uint256 private constant ONE_USDC = 1_000_000;
    uint256 private constant DEFAULT_QUOTE_RESERVE = 30_000 * ONE_USDC;
    uint256 private constant DEFAULT_TOKEN_RESERVE = 1_000_000_000 ether;

    function testOneMicroUsdcRoundTripNeverProfits() public pure {
        uint256 quoteOut = _roundTrip(1, DEFAULT_QUOTE_RESERVE, DEFAULT_TOKEN_RESERVE);
        assert(quoteOut <= 1);
    }

    function testOneUsdcRoundTripNeverProfits() public pure {
        uint256 quoteOut = _roundTrip(ONE_USDC, DEFAULT_QUOTE_RESERVE, DEFAULT_TOKEN_RESERVE);
        assert(quoteOut <= ONE_USDC);
    }

    function testRepeatedTinyRoundTripsNeverIncreaseQuote() public pure {
        uint256 startingQuote = ONE_USDC;
        uint256 currentQuote = startingQuote;
        uint256 quoteReserve = DEFAULT_QUOTE_RESERVE;
        uint256 tokenReserve = DEFAULT_TOKEN_RESERVE;

        for (uint256 i = 0; i < 64 && currentQuote != 0; ++i) {
            uint256 tokensOut = BreadBondingCurveMath.quoteAmountOut(currentQuote, quoteReserve, tokenReserve, 0);
            if (tokensOut == 0) break;

            quoteReserve += currentQuote;
            tokenReserve -= tokensOut;

            uint256 quoteOut = BreadBondingCurveMath.quoteAmountOut(tokensOut, tokenReserve, quoteReserve, 0);
            assert(quoteOut <= currentQuote);

            tokenReserve += tokensOut;
            quoteReserve -= quoteOut;
            currentQuote = quoteOut;
        }

        assert(currentQuote <= startingQuote);
    }

    function testFuzz_TinyRoundTripNeverProfits(
        uint32 quoteSeed,
        uint64 quoteReserveSeed,
        uint96 tokenReserveSeed
    ) public pure {
        uint256 quoteIn = uint256(quoteSeed) % (10 * ONE_USDC) + 1;
        uint256 quoteReserve = (uint256(quoteReserveSeed % 1_000_000_000) + 1) * ONE_USDC;
        uint256 tokenReserve = uint256(tokenReserveSeed % 10_000_000_000 ether) + 1 ether;

        uint256 quoteOut = _roundTrip(quoteIn, quoteReserve, tokenReserve);
        assert(quoteOut <= quoteIn);
    }

    function testFuzz_RepeatedTinyRoundTripsNeverIncreaseQuote(uint32 quoteSeed) public pure {
        uint256 startingQuote = uint256(quoteSeed) % (10 * ONE_USDC) + 1;
        uint256 currentQuote = startingQuote;
        uint256 quoteReserve = DEFAULT_QUOTE_RESERVE;
        uint256 tokenReserve = DEFAULT_TOKEN_RESERVE;

        for (uint256 i = 0; i < 64 && currentQuote != 0; ++i) {
            uint256 tokensOut = BreadBondingCurveMath.quoteAmountOut(currentQuote, quoteReserve, tokenReserve, 0);
            if (tokensOut == 0) break;

            quoteReserve += currentQuote;
            tokenReserve -= tokensOut;

            uint256 quoteOut = BreadBondingCurveMath.quoteAmountOut(tokensOut, tokenReserve, quoteReserve, 0);
            assert(quoteOut <= currentQuote);

            tokenReserve += tokensOut;
            quoteReserve -= quoteOut;
            currentQuote = quoteOut;
        }

        assert(currentQuote <= startingQuote);
    }

    function _roundTrip(uint256 quoteIn, uint256 quoteReserve, uint256 tokenReserve)
        private
        pure
        returns (uint256 quoteOut)
    {
        uint256 tokensOut = BreadBondingCurveMath.quoteAmountOut(quoteIn, quoteReserve, tokenReserve, 0);
        if (tokensOut == 0) return 0;

        uint256 quoteReserveAfterBuy = quoteReserve + quoteIn;
        uint256 tokenReserveAfterBuy = tokenReserve - tokensOut;
        return BreadBondingCurveMath.quoteAmountOut(tokensOut, tokenReserveAfterBuy, quoteReserveAfterBuy, 0);
    }
}
