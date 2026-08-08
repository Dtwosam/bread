// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../src/core/BreadBondingCurve.sol";
import {BreadLaunchToken} from "../src/BreadLaunchToken.sol";
import {BreadFeeEscrow} from "../src/fees/BreadFeeEscrow.sol";
import {BreadFeePolicy} from "../src/fees/BreadFeePolicy.sol";
import {BreadFeePolicySnapshot} from "../src/interfaces/IBreadFeePolicy.sol";
import {MockUSDC6} from "./helpers/MockUSDC6.sol";
import {BreadAlwaysOpenEmergencyController} from "./helpers/BreadEmergencyTestHelpers.sol";
import {BreadTestTime} from "./helpers/BreadTestTime.sol";
import {
    BreadFeeClaimRecipient,
    BreadTradingExternalCaller
} from "./helpers/BreadTradingActors.sol";

contract BreadTradingFeeEscrowIntegrationTest {
    uint256 private constant ONE_USDC = 1_000_000;
    uint256 private constant TOKEN_SUPPLY = 1_000_000 ether;
    uint256 private constant PHANTOM_QUOTE = 10_000 * ONE_USDC;
    uint256 private constant GRADUATION_THRESHOLD = 100_000 * ONE_USDC;
    uint16 private constant TRADE_FEE_BPS = 100;
    uint16 private constant PROTOCOL_SHARE_BPS = 2_500;
    uint16 private constant CREATOR_TAX_BPS = 500;
    address private constant PROTOCOL_RECIPIENT = address(0xA11CE);

    struct Fixture {
        MockUSDC6 usdc;
        BreadFeeEscrow escrow;
        BreadFeePolicy policy;
        BreadBondingCurve curve;
        BreadLaunchToken token;
    }

    struct FeeExpectation {
        uint256 quoteIn;
        uint256 baseFee;
        uint256 creatorTax;
        uint256 protocolAmount;
        uint256 creatorAmount;
        uint256 realQuote;
    }

    function testBuyFeesSweepIntoCanonicalEscrowWithoutChangingRealQuoteReserve() public {
        Fixture memory f = _deployFixture(PROTOCOL_RECIPIENT, address(0xB0B));
        f.escrow.setAuthorizedCreditor(address(f.curve), true);
        FeeExpectation memory e = _buy(f, 1_000 * ONE_USDC);

        assert(f.curve.realQuoteReserve() == e.realQuote);
        f.curve.sweepFees();

        assert(f.curve.quoteFeeBalance() == 0);
        assert(f.curve.creatorTaxBalance() == 0);
        assert(f.curve.trackedQuote() == e.realQuote);
        assert(f.curve.realQuoteReserve() == e.realQuote);
        assert(f.usdc.balanceOf(address(f.curve)) == e.realQuote);
        assert(f.usdc.balanceOf(address(f.escrow)) == e.baseFee + e.creatorTax);
        assert(f.escrow.balanceOf(PROTOCOL_RECIPIENT) == e.protocolAmount);
        assert(f.escrow.balanceOf(address(this)) == e.creatorAmount);
        assert(f.escrow.totalOutstanding() == e.baseFee + e.creatorTax);
    }

    function testFactoryCanUpdateCreatorFeeRecipient() public {
        Fixture memory f = _deployFixture(PROTOCOL_RECIPIENT, address(0xB0B));
        address nextRecipient = address(0xC0DE);

        f.curve.setCreatorFeeRecipient(nextRecipient);

        assert(f.curve.creatorFeeRecipient() == nextRecipient);
    }

    function testCreatorFeeRecipientRejectsZeroAddressAndNonFactoryCaller() public {
        Fixture memory f = _deployFixture(PROTOCOL_RECIPIENT, address(0xB0B));
        BreadTradingExternalCaller outsider = new BreadTradingExternalCaller();

        (bool zeroOk,) = address(f.curve).call(
            abi.encodeWithSelector(BreadBondingCurve.setCreatorFeeRecipient.selector, address(0))
        );
        (bool outsiderOk,) = address(outsider).call(
            abi.encodeWithSelector(
                BreadTradingExternalCaller.setCreatorFeeRecipient.selector,
                f.curve,
                address(0xC0DE)
            )
        );

        assert(!zeroOk);
        assert(!outsiderOk);
        assert(f.curve.creatorFeeRecipient() == address(this));
    }

    function testUnauthorizedCallerCannotSweepPendingFees() public {
        Fixture memory f = _deployFixture(PROTOCOL_RECIPIENT, address(0xB0B));
        f.escrow.setAuthorizedCreditor(address(f.curve), true);
        FeeExpectation memory e = _buy(f, 1_000 * ONE_USDC);
        BreadTradingExternalCaller outsider = new BreadTradingExternalCaller();

        (bool ok,) = address(outsider).call(
            abi.encodeWithSelector(BreadTradingExternalCaller.sweepFees.selector, f.curve)
        );

        assert(!ok);
        assert(f.curve.quoteFeeBalance() == e.baseFee);
        assert(f.curve.creatorTaxBalance() == e.creatorTax);
        assert(f.curve.trackedQuote() == e.quoteIn);
        assert(f.escrow.totalOutstanding() == 0);
    }

    function testRotatedLiveSweepOperatorCanSweepWithoutChangingSnapshottedEconomics() public {
        Fixture memory f = _deployFixture(PROTOCOL_RECIPIENT, address(0xB0B));
        BreadTradingExternalCaller operator = new BreadTradingExternalCaller();
        f.policy.setFeeSweepOperator(address(operator));
        f.escrow.setAuthorizedCreditor(address(f.curve), true);
        FeeExpectation memory e = _buy(f, 1_000 * ONE_USDC);

        operator.sweepFees(f.curve);

        assert(f.curve.protocolFeeShareBps() == PROTOCOL_SHARE_BPS);
        assert(f.escrow.balanceOf(PROTOCOL_RECIPIENT) == e.protocolAmount);
        assert(f.escrow.balanceOf(address(this)) == e.creatorAmount);
    }

    function testEscrowCreditFailureRollsBackSweepStateAndCustody() public {
        Fixture memory f = _deployFixture(PROTOCOL_RECIPIENT, address(0xB0B));
        FeeExpectation memory e = _buy(f, 1_000 * ONE_USDC);
        uint256 rawCurveBalanceBefore = f.usdc.balanceOf(address(f.curve));

        (bool ok,) = address(f.curve).call(abi.encodeWithSelector(BreadBondingCurve.sweepFees.selector));

        assert(!ok);
        assert(f.curve.quoteFeeBalance() == e.baseFee);
        assert(f.curve.creatorTaxBalance() == e.creatorTax);
        assert(f.curve.trackedQuote() == e.quoteIn);
        assert(f.curve.realQuoteReserve() == e.realQuote);
        assert(f.usdc.balanceOf(address(f.curve)) == rawCurveBalanceBefore);
        assert(f.usdc.balanceOf(address(f.escrow)) == 0);
        assert(f.escrow.totalOutstanding() == 0);
    }

    function testCreatorRecipientRotationDoesNotRewriteAlreadyCreditedClaims() public {
        Fixture memory f = _deployFixture(PROTOCOL_RECIPIENT, address(0xB0B));
        f.escrow.setAuthorizedCreditor(address(f.curve), true);
        FeeExpectation memory first = _buy(f, 1_000 * ONE_USDC);
        f.curve.sweepFees();
        uint256 oldCreatorClaim = f.escrow.balanceOf(address(this));
        assert(oldCreatorClaim == first.creatorAmount);

        BreadFeeClaimRecipient nextRecipient = new BreadFeeClaimRecipient();
        f.curve.setCreatorFeeRecipient(address(nextRecipient));
        FeeExpectation memory second = _buy(f, 500 * ONE_USDC);
        nextRecipient.sweepFees(f.curve);

        assert(f.escrow.balanceOf(address(this)) == oldCreatorClaim);
        assert(f.escrow.balanceOf(address(nextRecipient)) == second.creatorAmount);
    }

    function testIntegratedProtocolAndCreatorClaimsSettleOutstandingToZero() public {
        BreadFeeClaimRecipient protocolRecipient = new BreadFeeClaimRecipient();
        Fixture memory f = _deployFixture(address(protocolRecipient), address(0xB0B));
        f.escrow.setAuthorizedCreditor(address(f.curve), true);
        FeeExpectation memory e = _buy(f, 1_000 * ONE_USDC);
        f.curve.sweepFees();

        uint256 creatorClaim = f.escrow.claim();
        uint256 protocolClaim = protocolRecipient.claim(f.escrow);

        assert(creatorClaim == e.creatorAmount);
        assert(protocolClaim == e.protocolAmount);
        assert(f.usdc.balanceOf(address(this)) == e.creatorAmount);
        assert(f.usdc.balanceOf(address(protocolRecipient)) == e.protocolAmount);
        assert(f.usdc.balanceOf(address(f.escrow)) == 0);
        assert(f.escrow.balanceOf(address(this)) == 0);
        assert(f.escrow.balanceOf(address(protocolRecipient)) == 0);
        assert(f.escrow.totalOutstanding() == 0);
    }

    function _buy(Fixture memory f, uint256 quoteIn) private returns (FeeExpectation memory e) {
        e.quoteIn = quoteIn;
        e.baseFee = quoteIn * TRADE_FEE_BPS / 10_000;
        e.creatorTax = quoteIn * CREATOR_TAX_BPS / 10_000;
        e.protocolAmount = e.baseFee * PROTOCOL_SHARE_BPS / 10_000;
        e.creatorAmount = e.baseFee - e.protocolAmount + e.creatorTax;
        e.realQuote = quoteIn - e.baseFee - e.creatorTax;

        f.usdc.mint(address(this), quoteIn);
        assert(f.usdc.approve(address(f.curve), quoteIn));
        f.curve.buy(quoteIn, 0, address(this));
    }

    function _deployFixture(address protocolRecipient, address sweepOperator)
        private
        returns (Fixture memory f)
    {
        f.usdc = new MockUSDC6();
        BreadFeePolicySnapshot memory snapshot = BreadFeePolicySnapshot({
            protocolFeeRecipient: protocolRecipient,
            tradeFeeBps: TRADE_FEE_BPS,
            protocolFeeShareBps: PROTOCOL_SHARE_BPS,
            maxCreatorTaxBps: CREATOR_TAX_BPS
        });
        f.policy = new BreadFeePolicy(address(this), snapshot, sweepOperator);
        f.escrow = new BreadFeeEscrow(address(f.usdc), address(this));
        BreadAlwaysOpenEmergencyController emergencyController = new BreadAlwaysOpenEmergencyController();
        f.curve = new BreadBondingCurve(
            address(f.usdc),
            address(this),
            address(this),
            address(f.policy),
            address(f.escrow),
            address(emergencyController),
            PHANTOM_QUOTE,
            CREATOR_TAX_BPS,
            GRADUATION_THRESHOLD
        );

        BreadLaunchToken.Metadata memory metadata = BreadLaunchToken.Metadata({
            name: "Bread Test",
            symbol: "BREAD",
            logo: "",
            description: "",
            socials: BreadLaunchToken.Socials({twitter: "", telegram: "", discord: "", website: "", farcaster: ""})
        });
        BreadLaunchToken.LaunchContext memory context = BreadLaunchToken.LaunchContext({
            deployer: address(this),
            curve: address(f.curve),
            launchFactory: address(this),
            supply: TOKEN_SUPPLY
        });
        f.token = new BreadLaunchToken(metadata, context);
        f.curve.initialize(address(f.token));
        BreadTestTime.expireOpening(f.curve);
    }
}
