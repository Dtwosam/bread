// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadLaunchToken} from "../src/BreadLaunchToken.sol";
import {BreadTrackedCurveState} from "../src/core/BreadTrackedCurveState.sol";
import {BreadTrackedCurveStateHarness} from "./helpers/BreadTrackedCurveStateHarness.sol";
import {MockUSDC6} from "./helpers/MockUSDC6.sol";

contract BreadTrackedCurveStateTest {
    uint256 private constant ONE_USDC = 1_000_000;
    uint256 private constant PHANTOM_QUOTE = 30_000 * ONE_USDC;
    uint256 private constant GRADUATION_THRESHOLD = 70_000 * ONE_USDC;
    uint256 private constant SUPPLY = 1_000_000_000 ether;
    address private constant FACTORY = address(0xFAC7);

    function testRejectsZeroPairToken() public {
        try new BreadTrackedCurveStateHarness(address(0), PHANTOM_QUOTE, GRADUATION_THRESHOLD) returns (
            BreadTrackedCurveStateHarness
        ) {
            assert(false);
        } catch (bytes memory data) {
            _assertSelector(data, BreadTrackedCurveState.ZeroAddress.selector);
        }
    }

    function testInitializeUsesSixDecimalQuoteUnitsWithoutScaling() public {
        (MockUSDC6 quote, BreadTrackedCurveStateHarness harness,) =
            _deployInitialized(PHANTOM_QUOTE, GRADUATION_THRESHOLD, SUPPLY);

        assert(quote.decimals() == 6);
        assert(harness.pairToken() == address(quote));
        assert(harness.phantomQuote() == 30_000 * ONE_USDC);
        assert(harness.graduationThreshold() == 70_000 * ONE_USDC);

        harness.setTrackedQuoteBuckets(5 * ONE_USDC, 1 * ONE_USDC, ONE_USDC / 2);
        assert(harness.realQuoteReserve() == 3_500_000);
        assert(harness.quoteReserve() == PHANTOM_QUOTE + 3_500_000);
    }

    function testInitializeMatchesFrozenReservedAllocationFormula() public {
        (, BreadTrackedCurveStateHarness harness,) =
            _deployInitialized(PHANTOM_QUOTE, GRADUATION_THRESHOLD, SUPPLY);

        uint256 expected = SUPPLY * PHANTOM_QUOTE / (PHANTOM_QUOTE + GRADUATION_THRESHOLD);
        assert(harness.reservedTokens() == expected);
        assert(harness.sellableTokens() == SUPPLY - expected);
    }

    function testInitializeRecordsActualLaunchTokenBalance() public {
        (, BreadTrackedCurveStateHarness harness, BreadLaunchToken token) =
            _deployInitialized(PHANTOM_QUOTE, GRADUATION_THRESHOLD, SUPPLY);

        assert(harness.token() == address(token));
        assert(token.balanceOf(address(harness)) == SUPPLY);
        assert(harness.trackedTokens() == token.balanceOf(address(harness)));
    }

    function testInitializeRejectsZeroToken() public {
        MockUSDC6 quote = new MockUSDC6();
        BreadTrackedCurveStateHarness harness =
            new BreadTrackedCurveStateHarness(address(quote), PHANTOM_QUOTE, GRADUATION_THRESHOLD);

        (bool ok, bytes memory data) = address(harness).call(abi.encodeCall(harness.initialize, (address(0))));
        assert(!ok);
        _assertSelector(data, BreadTrackedCurveState.ZeroAddress.selector);
    }

    function testInitializeRejectsSecondInitialization() public {
        (, BreadTrackedCurveStateHarness harness, BreadLaunchToken token) =
            _deployInitialized(PHANTOM_QUOTE, GRADUATION_THRESHOLD, SUPPLY);

        (bool ok, bytes memory data) = address(harness).call(abi.encodeCall(harness.initialize, (address(token))));
        assert(!ok);
        _assertSelector(data, BreadTrackedCurveState.AlreadyInitialized.selector);
    }

    function testInitializeRejectsZeroReservedAllocation() public {
        MockUSDC6 quote = new MockUSDC6();
        BreadTrackedCurveStateHarness harness =
            new BreadTrackedCurveStateHarness(address(quote), 0, GRADUATION_THRESHOLD);
        BreadLaunchToken token = _deployToken(address(harness), SUPPLY);

        (bool ok, bytes memory data) = address(harness).call(abi.encodeCall(harness.initialize, (address(token))));
        assert(!ok);
        _assertSelector(data, BreadTrackedCurveState.InvalidLaunchEconomics.selector);
    }

    function testInitializeRejectsWholeSupplyReservedAllocation() public {
        MockUSDC6 quote = new MockUSDC6();
        BreadTrackedCurveStateHarness harness = new BreadTrackedCurveStateHarness(address(quote), PHANTOM_QUOTE, 0);
        BreadLaunchToken token = _deployToken(address(harness), SUPPLY);

        (bool ok, bytes memory data) = address(harness).call(abi.encodeCall(harness.initialize, (address(token))));
        assert(!ok);
        _assertSelector(data, BreadTrackedCurveState.InvalidLaunchEconomics.selector);
    }

    function testReserveReadersExcludePendingFeeAndTaxBuckets() public {
        (, BreadTrackedCurveStateHarness harness,) =
            _deployInitialized(PHANTOM_QUOTE, GRADUATION_THRESHOLD, SUPPLY);

        uint256 tracked = 12 * ONE_USDC;
        uint256 fee = 2 * ONE_USDC;
        uint256 tax = ONE_USDC / 2;
        harness.setTrackedQuoteBuckets(tracked, fee, tax);

        (uint256 quoteReserve_, uint256 tokenReserve_) = harness.getReserves();
        assert(quoteReserve_ == PHANTOM_QUOTE + tracked - fee - tax);
        assert(harness.quoteReserve() == quoteReserve_);
        assert(harness.realQuoteReserve() == tracked - fee - tax);
        assert(tokenReserve_ == harness.trackedTokens());
        assert(harness.tokenReserve() == tokenReserve_);
    }

    function testSellableTokensStopsAtReservedFloor() public {
        (, BreadTrackedCurveStateHarness harness,) =
            _deployInitialized(PHANTOM_QUOTE, GRADUATION_THRESHOLD, SUPPLY);
        uint256 reserved = harness.reservedTokens();

        harness.setTrackedTokens(reserved + 123);
        assert(harness.sellableTokens() == 123);

        harness.setTrackedTokens(reserved);
        assert(harness.sellableTokens() == 0);

        harness.setTrackedTokens(reserved - 1);
        assert(harness.sellableTokens() == 0);
    }

    function testReadyToGraduateUsesTrackedTokenFloor() public {
        (, BreadTrackedCurveStateHarness harness,) =
            _deployInitialized(PHANTOM_QUOTE, GRADUATION_THRESHOLD, SUPPLY);
        uint256 reserved = harness.reservedTokens();

        harness.setTrackedTokens(reserved + 1);
        assert(!harness.readyToGraduate());

        harness.setTrackedTokens(reserved);
        assert(harness.readyToGraduate());
    }

    function testGraduatedCurveIsNotReadyAgain() public {
        (, BreadTrackedCurveStateHarness harness,) =
            _deployInitialized(PHANTOM_QUOTE, GRADUATION_THRESHOLD, SUPPLY);

        harness.setTrackedTokens(harness.reservedTokens());
        assert(harness.readyToGraduate());
        harness.setGraduated(true);
        assert(!harness.readyToGraduate());
    }

    function testQuoteDonationDoesNotChangeTrackedReservesOrGraduation() public {
        (MockUSDC6 quote, BreadTrackedCurveStateHarness harness,) =
            _deployInitialized(PHANTOM_QUOTE, GRADUATION_THRESHOLD, SUPPLY);

        harness.setTrackedQuoteBuckets(10 * ONE_USDC, 2 * ONE_USDC, 1 * ONE_USDC);
        harness.setTrackedTokens(harness.reservedTokens() + 1);

        uint256 quoteReserveBefore = harness.quoteReserve();
        uint256 realReserveBefore = harness.realQuoteReserve();
        bool readinessBefore = harness.readyToGraduate();

        uint256 donation = 1_000_000 * ONE_USDC;
        quote.mint(address(this), donation);
        assert(quote.transfer(address(harness), donation));
        assert(quote.balanceOf(address(harness)) == donation);

        assert(harness.quoteReserve() == quoteReserveBefore);
        assert(harness.realQuoteReserve() == realReserveBefore);
        assert(harness.readyToGraduate() == readinessBefore);
        assert(!harness.readyToGraduate());
    }

    function testLaunchTokenDonationDoesNotChangeTrackedReserveOrDelayGraduation() public {
        (, BreadTrackedCurveStateHarness harness, BreadLaunchToken token) =
            _deployInitialized(PHANTOM_QUOTE, GRADUATION_THRESHOLD, SUPPLY);

        uint256 reserved = harness.reservedTokens();
        uint256 sellable = harness.sellableTokens();
        harness.simulateTrackedTokenOut(address(this), sellable);

        assert(harness.trackedTokens() == reserved);
        assert(token.balanceOf(address(harness)) == reserved);
        assert(harness.readyToGraduate());

        uint256 donation = sellable / 2;
        assert(donation != 0);
        assert(token.transfer(address(harness), donation));
        assert(token.balanceOf(address(harness)) == reserved + donation);

        assert(harness.tokenReserve() == reserved);
        assert(harness.sellableTokens() == 0);
        assert(harness.readyToGraduate());
    }

    function testFuzz_ReservedAllocationMatchesBoundedIndependentReference(
        uint96 supplySeed,
        uint64 phantomSeed,
        uint64 thresholdSeed
    ) public {
        uint256 supply = uint256(supplySeed % 1_000_000_000_000_000_000_000_000) + 1 ether;
        uint256 phantom = (uint256(phantomSeed % 1_000_000_000) + 1) * ONE_USDC;
        uint256 threshold = (uint256(thresholdSeed % 1_000_000_000) + 1) * ONE_USDC;
        uint256 expected = supply * phantom / (phantom + threshold);
        if (expected == 0 || expected >= supply) return;

        (, BreadTrackedCurveStateHarness harness,) = _deployInitialized(phantom, threshold, supply);
        assert(harness.reservedTokens() == expected);
        assert(harness.sellableTokens() == supply - expected);
    }

    function _deployInitialized(uint256 phantom, uint256 threshold, uint256 supply)
        private
        returns (MockUSDC6 quote, BreadTrackedCurveStateHarness harness, BreadLaunchToken token)
    {
        quote = new MockUSDC6();
        harness = new BreadTrackedCurveStateHarness(address(quote), phantom, threshold);
        token = _deployToken(address(harness), supply);
        harness.initialize(address(token));
    }

    function _deployToken(address curve, uint256 supply) private returns (BreadLaunchToken) {
        BreadLaunchToken.Metadata memory metadata = BreadLaunchToken.Metadata({
            name: "Bread State Test",
            symbol: "BST",
            logo: "",
            description: "",
            socials: BreadLaunchToken.Socials({twitter: "", telegram: "", discord: "", website: "", farcaster: ""})
        });
        BreadLaunchToken.LaunchContext memory context = BreadLaunchToken.LaunchContext({
            deployer: address(this),
            curve: curve,
            launchFactory: FACTORY,
            supply: supply
        });
        return new BreadLaunchToken(metadata, context);
    }

    function _assertSelector(bytes memory data, bytes4 expected) private pure {
        assert(data.length >= 4);
        bytes4 actual;
        assembly ("memory-safe") {
            actual := mload(add(data, 0x20))
        }
        assert(actual == expected);
    }
}
