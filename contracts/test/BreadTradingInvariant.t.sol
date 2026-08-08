// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../src/core/BreadBondingCurve.sol";
import {BreadLaunchToken} from "../src/BreadLaunchToken.sol";
import {BreadFeeEscrow} from "../src/fees/BreadFeeEscrow.sol";
import {BreadFeePolicy} from "../src/fees/BreadFeePolicy.sol";
import {BreadFeePolicySnapshot} from "../src/interfaces/IBreadFeePolicy.sol";
import {MockUSDC6} from "./helpers/MockUSDC6.sol";
import {BreadFeeClaimRecipient} from "./helpers/BreadTradingActors.sol";

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

    function testFuzz_SequentialTradingSweepClaimsAndDonationsPreserveAccounting(
        uint64 rawFirstBuy,
        uint64 rawSecondBuy,
        uint64 rawSellShare,
        uint64 rawQuoteDonation
    ) public {
        Fixture memory f = _deployFixture();
        uint256 firstBuy = 100 * ONE_USDC + (uint256(rawFirstBuy) % (400 * ONE_USDC));
        uint256 secondBuy = 100 * ONE_USDC + (uint256(rawSecondBuy) % (400 * ONE_USDC));
        uint256 totalFunding = firstBuy + secondBuy;

        f.usdc.mint(address(this), totalFunding);
        assert(f.usdc.approve(address(f.curve), totalFunding));
        f.curve.buy(firstBuy, 0, address(this));
        f.curve.buy(secondBuy, 0, address(this));

        uint256 boughtBalance = f.token.balanceOf(address(this));
        uint256 sellDivisor = 4 + (uint256(rawSellShare) % 5);
        uint256 tokensIn = boughtBalance / sellDivisor;
        assert(tokensIn != 0);
        assert(f.token.approve(address(f.curve), tokensIn));
        f.curve.sell(tokensIn, 0, address(this));

        uint256 trackedBeforeDonation = f.curve.trackedQuote();
        uint256 trackedTokensBeforeDonation = f.curve.trackedTokens();
        uint256 realQuoteBeforeSweep = f.curve.realQuoteReserve();
        uint256 pending = f.curve.quoteFeeBalance() + f.curve.creatorTaxBalance();
        assert(f.usdc.balanceOf(address(f.curve)) == trackedBeforeDonation);
        assert(f.token.balanceOf(address(f.curve)) == trackedTokensBeforeDonation);
        _assertReserveIdentity(f.curve);

        uint256 quoteDonation = uint256(rawQuoteDonation) % (25 * ONE_USDC);
        if (quoteDonation != 0) {
            f.usdc.mint(address(this), quoteDonation);
            assert(f.usdc.transfer(address(f.curve), quoteDonation));
        }
        uint256 userTokens = f.token.balanceOf(address(this));
        uint256 tokenDonation = userTokens / 20;
        if (tokenDonation != 0) assert(f.token.transfer(address(f.curve), tokenDonation));

        assert(f.curve.trackedQuote() == trackedBeforeDonation);
        assert(f.curve.trackedTokens() == trackedTokensBeforeDonation);
        assert(f.usdc.balanceOf(address(f.curve)) == trackedBeforeDonation + quoteDonation);
        assert(f.token.balanceOf(address(f.curve)) == trackedTokensBeforeDonation + tokenDonation);
        _assertReserveIdentity(f.curve);

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

        f.escrow.setAuthorizedCreditor(address(f.curve), true);
        f.curve.sweepFees();

        assert(f.curve.quoteFeeBalance() == 0);
        assert(f.curve.creatorTaxBalance() == 0);
        assert(f.curve.realQuoteReserve() == realQuoteBeforeSweep);
        assert(f.curve.trackedQuote() == trackedBeforeDonation - pending);
        assert(f.usdc.balanceOf(address(f.curve)) == f.curve.trackedQuote() + quoteDonation);
        _assertReserveIdentity(f.curve);

        uint256 protocolClaim = f.escrow.balanceOf(address(f.protocolRecipient));
        uint256 creatorClaim = f.escrow.balanceOf(address(this));
        assert(protocolClaim + creatorClaim == pending);
        assert(f.usdc.balanceOf(address(f.escrow)) == pending);
        assert(f.escrow.totalOutstanding() == pending);

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

        BreadLaunchToken.Socials memory socials;
        f.token = new BreadLaunchToken(
            "Bread Test",
            "BREAD",
            "",
            "",
            socials,
            address(this),
            address(f.curve),
            address(this),
            TOKEN_SUPPLY
        );
        f.curve.initialize(address(f.token));
    }
}
