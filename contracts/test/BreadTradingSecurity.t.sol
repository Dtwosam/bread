// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../src/core/BreadBondingCurve.sol";
import {BreadLaunchToken} from "../src/BreadLaunchToken.sol";
import {BreadFeeEscrow} from "../src/fees/BreadFeeEscrow.sol";
import {BreadFeePolicy} from "../src/fees/BreadFeePolicy.sol";
import {BreadFeePolicySnapshot} from "../src/interfaces/IBreadFeePolicy.sol";
import {MockUSDC6} from "./helpers/MockUSDC6.sol";
import {BreadAlwaysOpenEmergencyController} from "./helpers/BreadEmergencyTestHelpers.sol";
import {BreadTradingExternalCaller} from "./helpers/BreadTradingActors.sol";
import {BreadTestTime} from "./helpers/BreadTestTime.sol";

contract BreadTradingSecurityTest {
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
    }

    struct SellRollbackExpectations {
        uint256 quoteIn;
        uint256 buyNet;
        uint256 boughtTokens;
        uint256 tokensIn;
        uint256 expectedQuote;
        uint256 trackedQuoteBefore;
        uint256 trackedTokensBefore;
        uint256 feeBefore;
        uint256 taxBefore;
        uint256 userTokenBefore;
        uint256 curveTokenBefore;
    }

    function testCurveSnapshotsFeeEconomicsAgainstLaterPolicyChanges() public {
        Fixture memory f = _deployFixture(true, CREATOR_TAX_BPS);
        BreadFeePolicySnapshot memory nextPolicy = BreadFeePolicySnapshot({
            protocolFeeRecipient: address(0xCAFE),
            tradeFeeBps: 200,
            protocolFeeShareBps: 3_000,
            maxCreatorTaxBps: 600
        });

        f.policy.setCurrentFeePolicy(nextPolicy);

        assert(f.curve.protocolFeeRecipient() == address(0xA11CE));
        assert(f.curve.tradeFeeBps() == TRADE_FEE_BPS);
        assert(f.curve.protocolFeeShareBps() == PROTOCOL_SHARE_BPS);
        assert(f.curve.maxCreatorTaxBps() == CREATOR_TAX_BPS);
        assert(f.curve.creatorTaxBps() == CREATOR_TAX_BPS);
    }

    function testCurveConstructorRejectsCreatorTaxAboveSnapshottedMaximum() public {
        MockUSDC6 usdc = new MockUSDC6();
        BreadFeePolicySnapshot memory snapshot = BreadFeePolicySnapshot({
            protocolFeeRecipient: address(0xA11CE),
            tradeFeeBps: TRADE_FEE_BPS,
            protocolFeeShareBps: PROTOCOL_SHARE_BPS,
            maxCreatorTaxBps: CREATOR_TAX_BPS
        });
        BreadFeePolicy policy = new BreadFeePolicy(address(this), snapshot, address(0xB0B));
        BreadFeeEscrow escrow = new BreadFeeEscrow(address(usdc), address(this));
        BreadAlwaysOpenEmergencyController emergencyController = new BreadAlwaysOpenEmergencyController();

        bool reverted;
        try new BreadBondingCurve(
            address(usdc),
            address(this),
            address(this),
            address(policy),
            address(escrow),
            address(emergencyController),
            PHANTOM_QUOTE,
            CREATOR_TAX_BPS + 1,
            GRADUATION_THRESHOLD
        ) returns (BreadBondingCurve) {
            reverted = false;
        } catch {
            reverted = true;
        }

        assert(reverted);
    }

    function testInitializeIsFactoryOnlyAndOneShot() public {
        Fixture memory f = _deployFixture(false, CREATOR_TAX_BPS);
        BreadTradingExternalCaller outsider = new BreadTradingExternalCaller();

        (bool outsiderOk,) = address(outsider).call(
            abi.encodeWithSelector(BreadTradingExternalCaller.initialize.selector, f.curve, address(f.token))
        );
        assert(!outsiderOk);
        assert(f.curve.token() == address(0));

        f.curve.initialize(address(f.token));
        assert(f.curve.token() == address(f.token));

        (bool secondOk,) = address(f.curve).call(
            abi.encodeWithSelector(BreadBondingCurve.initialize.selector, address(f.token))
        );
        assert(!secondOk);
        assert(f.curve.token() == address(f.token));
    }

    function testBuySlippageFailureRollsBackCustodyAndTrackedState() public {
        Fixture memory f = _deployFixture(true, CREATOR_TAX_BPS);
        uint256 quoteIn = 1_000 * ONE_USDC;
        uint256 fee = quoteIn * TRADE_FEE_BPS / 10_000;
        uint256 tax = quoteIn * CREATOR_TAX_BPS / 10_000;
        uint256 expectedTokens = _amountOut(quoteIn - fee - tax, PHANTOM_QUOTE, TOKEN_SUPPLY);

        f.usdc.mint(address(this), quoteIn);
        assert(f.usdc.approve(address(f.curve), quoteIn));
        (bool ok,) = address(f.curve).call(
            abi.encodeWithSelector(BreadBondingCurve.buy.selector, quoteIn, expectedTokens + 1, address(this))
        );

        assert(!ok);
        assert(f.usdc.balanceOf(address(this)) == quoteIn);
        assert(f.usdc.balanceOf(address(f.curve)) == 0);
        assert(f.token.balanceOf(address(this)) == 0);
        assert(f.token.balanceOf(address(f.curve)) == TOKEN_SUPPLY);
        assert(f.curve.trackedQuote() == 0);
        assert(f.curve.trackedTokens() == TOKEN_SUPPLY);
        assert(f.curve.quoteFeeBalance() == 0);
        assert(f.curve.creatorTaxBalance() == 0);
    }

    function testSellSlippageFailureRollsBackTokenReceiptAndAccounting() public {
        Fixture memory f = _deployFixture(true, CREATOR_TAX_BPS);
        SellRollbackExpectations memory e;
        e.quoteIn = 2_000 * ONE_USDC;
        uint256 buyFee = e.quoteIn * TRADE_FEE_BPS / 10_000;
        uint256 buyTax = e.quoteIn * CREATOR_TAX_BPS / 10_000;
        e.buyNet = e.quoteIn - buyFee - buyTax;
        e.boughtTokens = _amountOut(e.buyNet, PHANTOM_QUOTE, TOKEN_SUPPLY);

        f.usdc.mint(address(this), e.quoteIn);
        assert(f.usdc.approve(address(f.curve), e.quoteIn));
        f.curve.buy(e.quoteIn, e.boughtTokens, address(this));

        e.tokensIn = e.boughtTokens / 4;
        uint256 grossQuote = _amountOut(e.tokensIn, TOKEN_SUPPLY - e.boughtTokens, PHANTOM_QUOTE + e.buyNet);
        uint256 sellFee = grossQuote * TRADE_FEE_BPS / 10_000;
        uint256 sellTax = grossQuote * CREATOR_TAX_BPS / 10_000;
        e.expectedQuote = grossQuote - sellFee - sellTax;
        e.trackedQuoteBefore = f.curve.trackedQuote();
        e.trackedTokensBefore = f.curve.trackedTokens();
        e.feeBefore = f.curve.quoteFeeBalance();
        e.taxBefore = f.curve.creatorTaxBalance();
        e.userTokenBefore = f.token.balanceOf(address(this));
        e.curveTokenBefore = f.token.balanceOf(address(f.curve));

        assert(f.token.approve(address(f.curve), e.tokensIn));
        (bool ok,) = address(f.curve).call(
            abi.encodeWithSelector(BreadBondingCurve.sell.selector, e.tokensIn, e.expectedQuote + 1, address(this))
        );

        assert(!ok);
        assert(f.token.balanceOf(address(this)) == e.userTokenBefore);
        assert(f.token.balanceOf(address(f.curve)) == e.curveTokenBefore);
        assert(f.curve.trackedQuote() == e.trackedQuoteBefore);
        assert(f.curve.trackedTokens() == e.trackedTokensBefore);
        assert(f.curve.quoteFeeBalance() == e.feeBefore);
        assert(f.curve.creatorTaxBalance() == e.taxBefore);
    }

    function testConcreteTradingReservesIgnoreDirectQuoteAndTokenDonations() public {
        Fixture memory f = _deployFixture(true, CREATOR_TAX_BPS);
        uint256 quoteIn = 1_000 * ONE_USDC;
        f.usdc.mint(address(this), quoteIn + 321 * ONE_USDC);
        assert(f.usdc.approve(address(f.curve), quoteIn));
        f.curve.buy(quoteIn, 0, address(this));

        (uint256 quoteBefore, uint256 tokenBefore) = f.curve.getReserves();
        uint256 trackedQuoteBefore = f.curve.trackedQuote();
        uint256 trackedTokensBefore = f.curve.trackedTokens();

        assert(f.usdc.transfer(address(f.curve), 321 * ONE_USDC));
        uint256 tokenDonation = f.token.balanceOf(address(this)) / 10;
        assert(f.token.transfer(address(f.curve), tokenDonation));

        (uint256 quoteAfter, uint256 tokenAfter) = f.curve.getReserves();
        assert(quoteAfter == quoteBefore);
        assert(tokenAfter == tokenBefore);
        assert(f.curve.trackedQuote() == trackedQuoteBefore);
        assert(f.curve.trackedTokens() == trackedTokensBefore);
    }

    function testFinalFillClosesSellPathBeforeGraduationExecution() public {
        Fixture memory f = _deployFixture(true, CREATOR_TAX_BPS);
        uint256 sellable = f.curve.sellableTokens();
        uint256 netRequired = _amountIn(sellable, PHANTOM_QUOTE, TOKEN_SUPPLY);
        uint256 spent = _ceilMulDiv(
            netRequired,
            10_000,
            10_000 - TRADE_FEE_BPS - CREATOR_TAX_BPS
        );
        uint256 quoteIn = spent + 1_000 * ONE_USDC;

        f.usdc.mint(address(this), quoteIn);
        assert(f.usdc.approve(address(f.curve), quoteIn));
        f.curve.buy(quoteIn, sellable, address(this));
        assert(f.curve.readyToGraduate());

        uint256 tokensIn = f.token.balanceOf(address(this)) / 100;
        assert(f.token.approve(address(f.curve), tokensIn));
        (bool ok,) = address(f.curve).call(
            abi.encodeWithSelector(BreadBondingCurve.sell.selector, tokensIn, 0, address(this))
        );
        assert(!ok);
    }

    function testFuzz_BuyThenSellCannotExtractQuote(uint96 rawQuote) public {
        Fixture memory f = _deployFixture(true, CREATOR_TAX_BPS);
        uint256 quoteIn = (uint256(rawQuote) % (1_000 * ONE_USDC)) + 1_000;
        f.usdc.mint(address(this), quoteIn);
        assert(f.usdc.approve(address(f.curve), quoteIn));

        uint256 tokensOut = f.curve.buy(quoteIn, 0, address(this));
        assert(tokensOut > 0);
        assert(f.token.approve(address(f.curve), tokensOut));
        f.curve.sell(tokensOut, 0, address(this));

        assert(f.usdc.balanceOf(address(this)) <= quoteIn);
    }

    function _deployFixture(bool initializeCurve, uint16 creatorTax)
        private
        returns (Fixture memory f)
    {
        f.usdc = new MockUSDC6();
        BreadFeePolicySnapshot memory snapshot = BreadFeePolicySnapshot({
            protocolFeeRecipient: address(0xA11CE),
            tradeFeeBps: TRADE_FEE_BPS,
            protocolFeeShareBps: PROTOCOL_SHARE_BPS,
            maxCreatorTaxBps: CREATOR_TAX_BPS
        });
        f.policy = new BreadFeePolicy(address(this), snapshot, address(0xB0B));
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
            creatorTax,
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
        if (initializeCurve) {
            f.curve.initialize(address(f.token));
            BreadTestTime.expireOpening(f.curve);
        }
    }

    function _amountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
        private
        pure
        returns (uint256)
    {
        return amountIn * reserveOut / (reserveIn + amountIn);
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
