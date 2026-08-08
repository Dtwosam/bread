// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {BreadBondingCurve} from "../src/core/BreadBondingCurve.sol";
import {BreadLaunchToken} from "../src/BreadLaunchToken.sol";
import {BreadFeeEscrow} from "../src/fees/BreadFeeEscrow.sol";
import {BreadFeePolicy} from "../src/fees/BreadFeePolicy.sol";
import {BreadLaunchFactory} from "../src/factory/BreadLaunchFactory.sol";
import {BreadLaunchDeployer} from "../src/factory/BreadLaunchDeployer.sol";
import {IBreadLaunchFactory} from "../src/interfaces/IBreadLaunchFactory.sol";
import {BreadFeePolicySnapshot} from "../src/interfaces/IBreadFeePolicy.sol";
import {MockUSDC6} from "./helpers/MockUSDC6.sol";
import {BreadAlwaysOpenEmergencyController} from "./helpers/BreadEmergencyTestHelpers.sol";

interface Vm {
    function warp(uint256 newTimestamp) external;
}

interface IBreadOpeningProtectionView {
    function launchTimestamp() external view returns (uint64);
    function currentSnipeTaxBps() external view returns (uint16);
    function launchBuyExemptionConsumed() external view returns (bool);
}

contract BreadLaunchBuyFactoryHarness {
    function initialize(BreadBondingCurve curve, address token) external {
        curve.initialize(token);
    }

    function approveQuote(IERC20 quote, BreadBondingCurve curve, uint256 amount) external {
        quote.approve(address(curve), amount);
    }

    function buyForLaunch(BreadBondingCurve curve, uint256 quoteIn, address recipient)
        external
        returns (uint256 tokensOut, uint256 spent, uint256 refund)
    {
        return curve.buyForLaunch(quoteIn, 0, recipient);
    }
}

contract BreadOpeningProtectionTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant ONE_USDC = 1_000_000;
    uint256 private constant SUPPLY = 1_000_000 ether;
    uint256 private constant PHANTOM_QUOTE = 10_000 * ONE_USDC;
    uint256 private constant GRADUATION_THRESHOLD = 100_000 * ONE_USDC;
    uint16 private constant TRADE_FEE_BPS = 100;
    uint16 private constant PROTOCOL_SHARE_BPS = 2_500;
    uint16 private constant MAX_CREATOR_TAX_BPS = 500;
    uint16 private constant CREATOR_TAX_BPS = 400;
    bytes32 private constant STACK_VERSION = keccak256("BREAD_DAY4_STACK_V1");

    address private constant PROTOCOL_RECIPIENT = address(0xA11CE);
    address private constant CREATOR_RECIPIENT = address(0xC0DE);
    address private constant BUY_RECIPIENT = address(0xB0B);

    struct Fixture {
        MockUSDC6 usdc;
        BreadFeePolicy policy;
        BreadFeeEscrow escrow;
        BreadLaunchFactory factory;
    }

    function testExactSnipeTaxVectorAndTerminalZero() public {
        vm.warp(1_000);
        Fixture memory f = _deployFixture();
        (, address curveAddress) = f.factory.launchToken(_params(f.factory.previewLaunchEconomics()));
        IBreadOpeningProtectionView curve = IBreadOpeningProtectionView(curveAddress);
        uint64 launchedAt = curve.launchTimestamp();

        assert(launchedAt == 1_000);
        assert(curve.currentSnipeTaxBps() == 9_900);
        vm.warp(uint256(launchedAt) + 1);
        assert(curve.currentSnipeTaxBps() == 6_336);
        vm.warp(uint256(launchedAt) + 2);
        assert(curve.currentSnipeTaxBps() == 3_564);
        vm.warp(uint256(launchedAt) + 3);
        assert(curve.currentSnipeTaxBps() == 1_584);
        vm.warp(uint256(launchedAt) + 4);
        assert(curve.currentSnipeTaxBps() == 396);
        vm.warp(uint256(launchedAt) + 5);
        assert(curve.currentSnipeTaxBps() == 0);
        vm.warp(uint256(launchedAt) + 30);
        assert(curve.currentSnipeTaxBps() == 0);
    }

    function testOrdinaryOpeningBuyTaxesAfterStandardFeesIntoQuoteFeeBucket() public {
        vm.warp(2_000);
        Fixture memory f = _deployFixture();
        (address token, address curveAddress) = f.factory.launchToken(_params(f.factory.previewLaunchEconomics()));
        BreadBondingCurve curve = BreadBondingCurve(curveAddress);
        uint256 quoteIn = 1_000 * ONE_USDC;
        (uint256 baseFee, uint256 creatorTax, uint256 snipeTax, uint256 netCurveInput) = _buyCharges(quoteIn, 9_900);
        uint256 expectedTokens = _amountOut(netCurveInput, PHANTOM_QUOTE, SUPPLY);

        f.usdc.mint(address(this), quoteIn);
        assert(f.usdc.approve(curveAddress, quoteIn));
        uint256 tokensOut = curve.buy(quoteIn, expectedTokens, BUY_RECIPIENT);

        assert(tokensOut == expectedTokens);
        assert(BreadLaunchToken(token).balanceOf(BUY_RECIPIENT) == expectedTokens);
        assert(curve.quoteFeeBalance() == baseFee + snipeTax);
        assert(curve.creatorTaxBalance() == creatorTax);
        assert(curve.realQuoteReserve() == netCurveInput);
        assert(curve.trackedQuote() == quoteIn);
    }

    function testSellNeverChargesOpeningTax() public {
        vm.warp(3_000);
        Fixture memory f = _deployFixture();
        (address token, address curveAddress) = f.factory.launchToken(_params(f.factory.previewLaunchEconomics()));
        BreadBondingCurve curve = BreadBondingCurve(curveAddress);
        uint256 quoteIn = 1_000 * ONE_USDC;
        f.usdc.mint(address(this), quoteIn);
        assert(f.usdc.approve(curveAddress, quoteIn));
        uint256 tokensOut = curve.buy(quoteIn, 0, address(this));

        uint256 quoteFeeBeforeSell = curve.quoteFeeBalance();
        uint256 creatorTaxBeforeSell = curve.creatorTaxBalance();
        (uint256 quoteReserveBefore, uint256 tokenReserveBefore) = curve.getReserves();
        uint256 tokensIn = tokensOut / 10;
        uint256 grossQuoteOut = _amountOut(tokensIn, tokenReserveBefore, quoteReserveBefore);
        uint256 sellBaseFee = grossQuoteOut * TRADE_FEE_BPS / 10_000;
        uint256 sellCreatorTax = grossQuoteOut * CREATOR_TAX_BPS / 10_000;
        uint256 expectedQuoteOut = grossQuoteOut - sellBaseFee - sellCreatorTax;
        assert(BreadLaunchToken(token).approve(curveAddress, tokensIn));

        uint256 quoteOut = curve.sell(tokensIn, expectedQuoteOut, address(this));

        assert(quoteOut == expectedQuoteOut);
        assert(curve.quoteFeeBalance() == quoteFeeBeforeSell + sellBaseFee);
        assert(curve.creatorTaxBalance() == creatorTaxBeforeSell + sellCreatorTax);
    }

    function testOpeningTaxSweepsThroughExistingBaseFeeSplitWhileCreatorTaxStaysSeparate() public {
        vm.warp(4_000);
        Fixture memory f = _deployFixture();
        (, address curveAddress) = f.factory.launchToken(_params(f.factory.previewLaunchEconomics()));
        BreadBondingCurve curve = BreadBondingCurve(curveAddress);
        f.escrow.setAuthorizedCreditor(curveAddress, true);
        uint256 quoteIn = 1_000 * ONE_USDC;
        (uint256 baseFee, uint256 creatorTax, uint256 snipeTax,) = _buyCharges(quoteIn, 9_900);
        uint256 combinedBaseBucket = baseFee + snipeTax;
        uint256 protocolAmount = combinedBaseBucket * PROTOCOL_SHARE_BPS / 10_000;
        uint256 creatorAmount = combinedBaseBucket - protocolAmount + creatorTax;

        f.usdc.mint(address(this), quoteIn);
        assert(f.usdc.approve(curveAddress, quoteIn));
        curve.buy(quoteIn, 0, address(this));
        curve.sweepFees();

        assert(f.escrow.balanceOf(PROTOCOL_RECIPIENT) == protocolAmount);
        assert(f.escrow.balanceOf(CREATOR_RECIPIENT) == creatorAmount);
        assert(f.escrow.totalOutstanding() == combinedBaseBucket + creatorTax);
        assert(curve.quoteFeeBalance() == 0);
        assert(curve.creatorTaxBalance() == 0);
    }

    function testLaunchAndBuyConsumesOnlyExemptionThenSameCallerOrdinaryBuyIsTaxed() public {
        vm.warp(5_000);
        Fixture memory f = _deployFixture();
        uint256 firstQuote = 500 * ONE_USDC;
        uint256 secondQuote = 500 * ONE_USDC;
        f.usdc.mint(address(this), firstQuote + secondQuote);
        assert(f.usdc.approve(address(f.factory), firstQuote));

        (address token, address curveAddress,) = IBreadLaunchFactory(address(f.factory)).launchTokenAndBuy(
            _params(f.factory.previewLaunchEconomics()), firstQuote, 0, address(this)
        );
        BreadBondingCurve curve = BreadBondingCurve(curveAddress);
        IBreadOpeningProtectionView opening = IBreadOpeningProtectionView(curveAddress);
        uint256 firstBase = firstQuote * TRADE_FEE_BPS / 10_000;
        uint256 firstCreatorTax = firstQuote * CREATOR_TAX_BPS / 10_000;

        assert(opening.launchBuyExemptionConsumed());
        assert(curve.quoteFeeBalance() == firstBase);
        assert(curve.creatorTaxBalance() == firstCreatorTax);

        assert(f.usdc.approve(curveAddress, secondQuote));
        uint256 quoteFeeBefore = curve.quoteFeeBalance();
        (uint256 secondBase,, uint256 secondSnipe,) = _buyCharges(secondQuote, 9_900);
        curve.buy(secondQuote, 0, address(this));

        assert(curve.quoteFeeBalance() == quoteFeeBefore + secondBase + secondSnipe);
        assert(BreadLaunchToken(token).balanceOf(address(this)) > 0);
    }

    function testLaunchOnlyDoesNotConsumeExemption() public {
        vm.warp(6_000);
        Fixture memory f = _deployFixture();
        (, address curveAddress) = f.factory.launchToken(_params(f.factory.previewLaunchEconomics()));
        assert(!IBreadOpeningProtectionView(curveAddress).launchBuyExemptionConsumed());
    }

    function testConfiguredFactoryCannotReplayOrDelayLaunchBuyExemption() public {
        vm.warp(7_000);
        (MockUSDC6 usdc, BreadBondingCurve curve, BreadLaunchBuyFactoryHarness factoryHarness) = _deployHarnessCurve();
        uint256 quoteIn = 100 * ONE_USDC;
        usdc.mint(address(factoryHarness), quoteIn * 3);
        factoryHarness.approveQuote(usdc, curve, quoteIn * 3);

        factoryHarness.buyForLaunch(curve, quoteIn, BUY_RECIPIENT);
        assert(IBreadOpeningProtectionView(address(curve)).launchBuyExemptionConsumed());

        (bool replayOk,) = address(factoryHarness).call(
            abi.encodeWithSelector(BreadLaunchBuyFactoryHarness.buyForLaunch.selector, curve, quoteIn, BUY_RECIPIENT)
        );
        assert(!replayOk);

        vm.warp(8_000);
        (MockUSDC6 laterUsdc, BreadBondingCurve laterCurve, BreadLaunchBuyFactoryHarness laterFactory) = _deployHarnessCurve();
        laterUsdc.mint(address(laterFactory), quoteIn);
        laterFactory.approveQuote(laterUsdc, laterCurve, quoteIn);
        vm.warp(8_001);

        (bool delayedOk,) = address(laterFactory).call(
            abi.encodeWithSelector(BreadLaunchBuyFactoryHarness.buyForLaunch.selector, laterCurve, quoteIn, BUY_RECIPIENT)
        );
        assert(!delayedOk);
        assert(!IBreadOpeningProtectionView(address(laterCurve)).launchBuyExemptionConsumed());
    }

    function testOpeningProtectionViewRejectsBeforeInitialization() public {
        vm.warp(9_000);
        MockUSDC6 usdc = new MockUSDC6();
        BreadFeePolicySnapshot memory snapshot = _policySnapshot();
        BreadFeePolicy policy = new BreadFeePolicy(address(this), snapshot, address(this));
        BreadFeeEscrow escrow = new BreadFeeEscrow(address(usdc), address(this));
        BreadAlwaysOpenEmergencyController emergencyController = new BreadAlwaysOpenEmergencyController();
        BreadBondingCurve curve = new BreadBondingCurve(
            address(usdc), CREATOR_RECIPIENT, address(this), address(policy), address(escrow), address(emergencyController),
            PHANTOM_QUOTE, CREATOR_TAX_BPS, GRADUATION_THRESHOLD
        );

        (bool ok,) = address(curve).staticcall(abi.encodeWithSignature("currentSnipeTaxBps()"));
        assert(!ok);
    }

    function _deployFixture() private returns (Fixture memory f) {
        f.usdc = new MockUSDC6();
        BreadFeePolicySnapshot memory snapshot = _policySnapshot();
        f.policy = new BreadFeePolicy(address(this), snapshot, address(this));
        f.escrow = new BreadFeeEscrow(address(f.usdc), address(this));
        BreadAlwaysOpenEmergencyController emergencyController = new BreadAlwaysOpenEmergencyController();
        IBreadLaunchFactory.LaunchConfig memory config = IBreadLaunchFactory.LaunchConfig({
            supply: SUPPLY,
            phantomQuote: PHANTOM_QUOTE,
            graduationThreshold: GRADUATION_THRESHOLD,
            launchFeeUsdc: 0,
            enabled: false
        });
        f.factory = new BreadLaunchFactory(
            address(this), address(f.usdc), address(f.policy), address(f.escrow), address(emergencyController), config, STACK_VERSION
        );
        BreadLaunchDeployer deployer = new BreadLaunchDeployer(address(f.factory));
        f.factory.setLaunchDeployer(deployer);
        config.enabled = true;
        f.factory.setLaunchConfig(config);
    }

    function _deployHarnessCurve()
        private
        returns (MockUSDC6 usdc, BreadBondingCurve curve, BreadLaunchBuyFactoryHarness factoryHarness)
    {
        usdc = new MockUSDC6();
        BreadFeePolicy policy = new BreadFeePolicy(address(this), _policySnapshot(), address(this));
        BreadFeeEscrow escrow = new BreadFeeEscrow(address(usdc), address(this));
        BreadAlwaysOpenEmergencyController emergencyController = new BreadAlwaysOpenEmergencyController();
        factoryHarness = new BreadLaunchBuyFactoryHarness();
        curve = new BreadBondingCurve(
            address(usdc), CREATOR_RECIPIENT, address(factoryHarness), address(policy), address(escrow), address(emergencyController),
            PHANTOM_QUOTE, CREATOR_TAX_BPS, GRADUATION_THRESHOLD
        );
        BreadLaunchToken.Metadata memory metadata = BreadLaunchToken.Metadata({
            name: "Harness",
            symbol: "HRN",
            logo: "",
            description: "",
            socials: BreadLaunchToken.Socials({twitter: "", telegram: "", discord: "", website: "", farcaster: ""})
        });
        BreadLaunchToken.LaunchContext memory context = BreadLaunchToken.LaunchContext({
            deployer: address(this), curve: address(curve), launchFactory: address(factoryHarness), supply: SUPPLY
        });
        BreadLaunchToken token = new BreadLaunchToken(metadata, context);
        factoryHarness.initialize(curve, address(token));
    }

    function _policySnapshot() private pure returns (BreadFeePolicySnapshot memory snapshot) {
        snapshot = BreadFeePolicySnapshot({
            protocolFeeRecipient: PROTOCOL_RECIPIENT,
            tradeFeeBps: TRADE_FEE_BPS,
            protocolFeeShareBps: PROTOCOL_SHARE_BPS,
            maxCreatorTaxBps: MAX_CREATOR_TAX_BPS
        });
    }

    function _params(bytes32 expectedEconomics)
        private
        pure
        returns (IBreadLaunchFactory.LaunchParams memory p)
    {
        p.name = "Bread Opening";
        p.symbol = "OPEN";
        p.logo = "";
        p.description = "";
        p.twitter = "";
        p.telegram = "";
        p.discord = "";
        p.website = "";
        p.farcaster = "";
        p.creatorFeeRecipient = CREATOR_RECIPIENT;
        p.creatorTaxBps = CREATOR_TAX_BPS;
        p.expectedEconomics = expectedEconomics;
    }

    function _buyCharges(uint256 spent, uint16 snipeBps)
        private
        pure
        returns (uint256 baseFee, uint256 creatorTax, uint256 snipeTax, uint256 netCurveInput)
    {
        baseFee = spent * TRADE_FEE_BPS / 10_000;
        creatorTax = spent * CREATOR_TAX_BPS / 10_000;
        uint256 afterStandard = spent - baseFee - creatorTax;
        snipeTax = afterStandard * snipeBps / 10_000;
        netCurveInput = afterStandard - snipeTax;
    }

    function _amountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
        private
        pure
        returns (uint256)
    {
        return amountIn * reserveOut / (reserveIn + amountIn);
    }
}
