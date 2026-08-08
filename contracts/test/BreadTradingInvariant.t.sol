// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../src/core/BreadBondingCurve.sol";
import {BreadLaunchToken} from "../src/BreadLaunchToken.sol";
import {BreadFeeEscrow} from "../src/fees/BreadFeeEscrow.sol";
import {BreadFeePolicy} from "../src/fees/BreadFeePolicy.sol";
import {BreadFeePolicySnapshot} from "../src/interfaces/IBreadFeePolicy.sol";
import {MockUSDC6} from "./helpers/MockUSDC6.sol";
import {BreadFeeClaimRecipient} from "./helpers/BreadTradingActors.sol";
import {BreadTestTime} from "./helpers/BreadTestTime.sol";

contract BreadTradingInvariantTest {
    uint256 private constant ONE_USDC = 1_000_000;
    uint256 private constant TOKEN_SUPPLY = 1_000_000 ether;
    uint256 private constant PHANTOM_QUOTE = 10_000 * ONE_USDC;
    uint256 private constant GRADUATION_THRESHOLD = 100_000 * ONE_USDC;
    uint16 private constant TRADE_FEE_BPS = 100;
    uint16 private constant PROTOCOL_SHARE_BPS = 2_500;
    uint16 private constant CREATOR_TAX_BPS = 500;

    struct Fixture {
        MockUSDC6 usdc;
        BreadFeePolicy policy;
        BreadFeeEscrow escrow;
        BreadBondingCurve curve;
        BreadLaunchToken token;
        BreadFeeClaimRecipient protocolRecipient;
    }

    struct SequenceState {
        uint256 trackedBeforeDonation;
        uint256 trackedTokensBeforeDonation;
        uint256 realQuoteBeforeSweep;
        uint256 pending;
        uint256 quoteDonation;
        uint256 tokenDonation;
    }

    function testFuzz_SequentialTradingSweepClaimsAndDonationsPreserveAccounting(
        uint64 rawFirstBuy,
        uint64 rawSecondBuy,
        uint64 rawSellShare,
        uint64 rawQuoteDonation
    ) public {
        Fixture memory f = _deployFixture();
        SequenceState memory s = _executeTrades(f, rawFirstBuy, rawSecondBuy, rawSellShare);
        _applyDonationsAndAssert(f, s, rawQuoteDonation);
        _updateFuturePolicyAndAssertSnapshot(f);
        _sweepAndAssert(f, s);
        _settleAndAssertClaims(f, s.pending);
    }

    function _executeTrades(Fixture memory f, uint64 rawFirstBuy, uint64 rawSecondBuy, uint64 rawSellShare)
        private
        returns (SequenceState memory s)
    {
        uint256 firstBuy = 100 * ONE_USDC + (uint256(rawFirstBuy) % (400 * ONE_USDC));
        uint256 secondBuy = 100 * ONE_USDC + (uint256(rawSecondBuy) % (400 * ONE_USDC));
        uint256 totalFunding = firstBuy + secondBuy;

        f.usdc.mint(address(this), totalFunding);
        assert(f.usdc.approve(address(f.curve), totalFunding));
        f.curve.buy(firstBuy, 0, address(this));
        f.curve.buy(secondBuy, 0, address(this));

        uint256 tokensIn = f.token.balanceOf(address(this)) / (4 + (uint256(rawSellShare) % 5));
        assert(tokensIn != 0);
        assert(f.token.approve(address(f.curve), tokensIn));
        f.curve.sell(tokensIn, 0, address(this));

        s.trackedBeforeDonation = f.curve.trackedQuote();
        s.trackedTokensBeforeDonation = f.curve.trackedTokens();
        s.realQuoteBeforeSweep = f.curve.realQuoteReserve();
        s.pending = f.curve.quoteFeeBalance() + f.curve.creatorTaxBalance();

        assert(f.usdc.balanceOf(address(f.curve)) == s.trackedBeforeDonation);
        assert(f.token.balanceOf(address(f.curve)) == s.trackedTokensBeforeDonation);
        _assertReserveIdentity(f.curve);
    }

    function _applyDonationsAndAssert(Fixture memory f, SequenceState memory s, uint64 rawQuoteDonation) private {
        s.quoteDonation = uint256(rawQuoteDonation) % (25 * ONE_USDC);
        if (s.quoteDonation != 0) {
            f.usdc.mint(address(this), s.quoteDonation);
            assert(f.usdc.transfer(address(f.curve), s.quoteDonation));
        }

        s.tokenDonation = f.token.balanceOf(address(this)) / 20;
        if (s.tokenDonation != 0) assert(f.token.transfer(address(f.curve), s.tokenDonation));

        assert(f.curve.trackedQuote() == s.trackedBeforeDonation);
        assert(f.curve.trackedTokens() == s.trackedTokensBeforeDonation);
        assert(f.usdc.balanceOf(address(f.curve)) == s.trackedBeforeDonation + s.quoteDonation);
        assert(f.token.balanceOf(address(f.curve)) == s.trackedTokensBeforeDonation + s.tokenDonation);
        _assertReserveIdentity(f.curve);
    }

    function _updateFuturePolicyAndAssertSnapshot(Fixture memory f) private {
        BreadFeePolicySnapshot memory nextPolicy = BreadFeePolicySnapshot({
            protocolFeeRecipient: address(0xCAFE),
            tradeFeeBps: 125,
            protocolFeeShareBps: 3_000,
            maxCreatorTaxBps: 600
        });
        f.policy.setCurrentFeePolicy(nextPolicy);

        assert(f.curve.tradeFeeBps() == TRADE_FEE_BPS);
        assert(f.curve.protocolFeeShareBps() == PROTOCOL_SHARE_BPS);
        assert(f.curve.maxCreatorTaxBps() == CREATOR_TAX_BPS);
        assert(f.curve.protocolFeeRecipient() == address(f.protocolRecipient));
    }

    function _sweepAndAssert(Fixture memory f, SequenceState memory s) private {
        f.escrow.setAuthorizedCreditor(address(f.curve), true);
        f.curve.sweepFees();

        assert(f.curve.quoteFeeBalance() == 0);
        assert(f.curve.creatorTaxBalance() == 0);
        assert(f.curve.realQuoteReserve() == s.realQuoteBeforeSweep);
        assert(f.curve.trackedQuote() == s.trackedBeforeDonation - s.pending);
        assert(f.usdc.balanceOf(address(f.curve)) == f.curve.trackedQuote() + s.quoteDonation);
        _assertReserveIdentity(f.curve);

        uint256 protocolClaim = f.escrow.balanceOf(address(f.protocolRecipient));
        uint256 creatorClaim = f.escrow.balanceOf(address(this));
        assert(protocolClaim + creatorClaim == s.pending);
        assert(f.usdc.balanceOf(address(f.escrow)) == s.pending);
        assert(f.escrow.totalOutstanding() == s.pending);
    }

    function _settleAndAssertClaims(Fixture memory f, uint256 pending) private {
        assert(pending != 0);
        f.escrow.claim();
        f.protocolRecipient.claim(f.escrow);

        assert(f.escrow.totalOutstanding() == 0);
        assert(f.usdc.balanceOf(address(f.escrow)) == 0);
        assert(f.escrow.balanceOf(address(this)) == 0);
        assert(f.escrow.balanceOf(address(f.protocolRecipient)) == 0);
    }

    function _assertReserveIdentity(BreadBondingCurve curve) private view {
        uint256 expectedRealQuote = curve.trackedQuote() - curve.quoteFeeBalance() - curve.creatorTaxBalance();
        (uint256 quoteReserve, uint256 tokenReserve) = curve.getReserves();
        assert(curve.realQuoteReserve() == expectedRealQuote);
        assert(quoteReserve == PHANTOM_QUOTE + expectedRealQuote);
        assert(tokenReserve == curve.trackedTokens());
        assert(curve.trackedTokens() >= curve.reservedTokens());
    }

    function _deployFixture() private returns (Fixture memory f) {
        f.usdc = new MockUSDC6();
        f.protocolRecipient = new BreadFeeClaimRecipient();
        BreadFeePolicySnapshot memory snapshot = BreadFeePolicySnapshot({
            protocolFeeRecipient: address(f.protocolRecipient),
            tradeFeeBps: TRADE_FEE_BPS,
            protocolFeeShareBps: PROTOCOL_SHARE_BPS,
            maxCreatorTaxBps: CREATOR_TAX_BPS
        });
        f.policy = new BreadFeePolicy(address(this), snapshot, address(0xB0B));
        f.escrow = new BreadFeeEscrow(address(f.usdc), address(this));
        f.curve = new BreadBondingCurve(
            address(f.usdc),
            address(this),
            address(this),
            address(f.policy),
            address(f.escrow),
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
