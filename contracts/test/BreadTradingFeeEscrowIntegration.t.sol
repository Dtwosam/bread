// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../src/core/BreadBondingCurve.sol";
import {BreadLaunchToken} from "../src/BreadLaunchToken.sol";
import {BreadFeeEscrow} from "../src/fees/BreadFeeEscrow.sol";
import {BreadFeePolicy} from "../src/fees/BreadFeePolicy.sol";
import {BreadFeePolicySnapshot} from "../src/interfaces/IBreadFeePolicy.sol";
import {MockUSDC6} from "./helpers/MockUSDC6.sol";
import {BreadTradingExternalCaller} from "./helpers/BreadTradingActors.sol";

contract BreadTradingFeeEscrowIntegrationTest {
    uint256 private constant ONE_USDC = 1_000_000;
    uint256 private constant TOKEN_SUPPLY = 1_000_000 ether;
    uint256 private constant PHANTOM_QUOTE = 10_000 * ONE_USDC;
    uint256 private constant GRADUATION_THRESHOLD = 100_000 * ONE_USDC;
    uint16 private constant TRADE_FEE_BPS = 100;
    uint16 private constant PROTOCOL_SHARE_BPS = 2_500;
    uint16 private constant CREATOR_TAX_BPS = 500;
    address private constant PROTOCOL_RECIPIENT = address(0xA11CE);

    function testBuyFeesSweepIntoCanonicalEscrowWithoutChangingRealQuoteReserve() public {
        (MockUSDC6 usdc, BreadFeeEscrow escrow, BreadBondingCurve curve) = _deployFixture();
        escrow.setAuthorizedCreditor(address(curve), true);

        uint256 quoteIn = 1_000 * ONE_USDC;
        uint256 baseFee = quoteIn * TRADE_FEE_BPS / 10_000;
        uint256 creatorTax = quoteIn * CREATOR_TAX_BPS / 10_000;
        uint256 protocolAmount = baseFee * PROTOCOL_SHARE_BPS / 10_000;
        uint256 creatorAmount = baseFee - protocolAmount + creatorTax;
        uint256 expectedRealQuote = quoteIn - baseFee - creatorTax;

        usdc.mint(address(this), quoteIn);
        assert(usdc.approve(address(curve), quoteIn));
        curve.buy(quoteIn, 0, address(this));

        assert(curve.realQuoteReserve() == expectedRealQuote);
        curve.sweepFees();

        assert(curve.quoteFeeBalance() == 0);
        assert(curve.creatorTaxBalance() == 0);
        assert(curve.trackedQuote() == expectedRealQuote);
        assert(curve.realQuoteReserve() == expectedRealQuote);
        assert(usdc.balanceOf(address(curve)) == expectedRealQuote);
        assert(usdc.balanceOf(address(escrow)) == baseFee + creatorTax);
        assert(escrow.balanceOf(PROTOCOL_RECIPIENT) == protocolAmount);
        assert(escrow.balanceOf(address(this)) == creatorAmount);
        assert(escrow.totalOutstanding() == baseFee + creatorTax);
    }

    function testFactoryCanUpdateCreatorFeeRecipient() public {
        (, , BreadBondingCurve curve) = _deployFixture();
        address nextRecipient = address(0xC0DE);

        curve.setCreatorFeeRecipient(nextRecipient);

        assert(curve.creatorFeeRecipient() == nextRecipient);
    }

    function testCreatorFeeRecipientRejectsZeroAddressAndNonFactoryCaller() public {
        (, , BreadBondingCurve curve) = _deployFixture();
        BreadTradingExternalCaller outsider = new BreadTradingExternalCaller();

        (bool zeroOk,) = address(curve).call(
            abi.encodeWithSelector(BreadBondingCurve.setCreatorFeeRecipient.selector, address(0))
        );
        (bool outsiderOk,) = address(outsider).call(
            abi.encodeWithSelector(
                BreadTradingExternalCaller.setCreatorFeeRecipient.selector,
                curve,
                address(0xC0DE)
            )
        );

        assert(!zeroOk);
        assert(!outsiderOk);
        assert(curve.creatorFeeRecipient() == address(this));
    }

    function _deployFixture()
        private
        returns (MockUSDC6 usdc, BreadFeeEscrow escrow, BreadBondingCurve curve)
    {
        usdc = new MockUSDC6();
        BreadFeePolicySnapshot memory snapshot = BreadFeePolicySnapshot({
            protocolFeeRecipient: PROTOCOL_RECIPIENT,
            tradeFeeBps: TRADE_FEE_BPS,
            protocolFeeShareBps: PROTOCOL_SHARE_BPS,
            maxCreatorTaxBps: CREATOR_TAX_BPS
        });
        BreadFeePolicy policy = new BreadFeePolicy(address(this), snapshot, address(0xB0B));
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
        BreadLaunchToken token = new BreadLaunchToken(
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
}
