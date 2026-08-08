// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../src/core/BreadBondingCurve.sol";
import {BreadLaunchToken} from "../src/BreadLaunchToken.sol";
import {BreadFeeEscrow} from "../src/fees/BreadFeeEscrow.sol";
import {BreadFeePolicy} from "../src/fees/BreadFeePolicy.sol";
import {BreadFeePolicySnapshot} from "../src/interfaces/IBreadFeePolicy.sol";
import {MockUSDC6} from "./helpers/MockUSDC6.sol";

contract BreadFinalBuyInvariantTest {
    uint256 private constant ONE_USDC = 1_000_000;
    uint256 private constant TOKEN_SUPPLY = 1_000_000 ether;
    uint256 private constant PHANTOM_QUOTE = 10_000 * ONE_USDC;
    uint256 private constant GRADUATION_THRESHOLD = 100_000 * ONE_USDC;
    uint16 private constant TRADE_FEE_BPS = 100;
    uint16 private constant CREATOR_TAX_BPS = 500;

    function testFuzz_FinalBuyNeverCrossesReservedFloorAndRefundsAllExcess(uint64 rawExtraQuote) public {
        (MockUSDC6 usdc, BreadBondingCurve curve, BreadLaunchToken token) = _deployFixture();
        uint256 sellable = curve.sellableTokens();
        uint256 netRequired = _amountIn(sellable, PHANTOM_QUOTE, TOKEN_SUPPLY);
        uint256 spent = _ceilMulDiv(
            netRequired,
            10_000,
            10_000 - TRADE_FEE_BPS - CREATOR_TAX_BPS
        );
        uint256 extraQuote = (uint256(rawExtraQuote) % (5_000 * ONE_USDC)) + 1;
        uint256 quoteIn = spent + extraQuote;

        usdc.mint(address(this), quoteIn);
        assert(usdc.approve(address(curve), quoteIn));
        uint256 tokensOut = curve.buy(quoteIn, sellable, address(this));

        uint256 fee = spent * TRADE_FEE_BPS / 10_000;
        uint256 tax = spent * CREATOR_TAX_BPS / 10_000;
        assert(tokensOut == sellable);
        assert(token.balanceOf(address(this)) == sellable);
        assert(curve.trackedTokens() == curve.reservedTokens());
        assert(curve.readyToGraduate());
        assert(curve.trackedQuote() == spent);
        assert(curve.quoteFeeBalance() == fee);
        assert(curve.creatorTaxBalance() == tax);
        assert(usdc.balanceOf(address(curve)) == spent);
        assert(usdc.balanceOf(address(this)) == extraQuote);
        assert(curve.realQuoteReserve() == spent - fee - tax);
    }

    function _deployFixture() private returns (MockUSDC6 usdc, BreadBondingCurve curve, BreadLaunchToken token) {
        usdc = new MockUSDC6();
        BreadFeePolicySnapshot memory snapshot = BreadFeePolicySnapshot({
            protocolFeeRecipient: address(0xA11CE),
            tradeFeeBps: TRADE_FEE_BPS,
            protocolFeeShareBps: 2_500,
            maxCreatorTaxBps: CREATOR_TAX_BPS
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
