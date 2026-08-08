// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../src/core/BreadBondingCurve.sol";
import {BreadLaunchToken} from "../src/BreadLaunchToken.sol";
import {IBreadLaunchFactory} from "../src/interfaces/IBreadLaunchFactory.sol";
import {BreadDay4Fixture} from "./helpers/BreadDay4Fixture.sol";

interface BreadGraduationVm {
    struct Log {
        bytes32[] topics;
        bytes data;
        address emitter;
    }

    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory entries);
}

contract BreadGraduationCurveHandoffTest is BreadDay4Fixture {
    BreadGraduationVm private constant VM =
        BreadGraduationVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    bytes32 private constant AUTO_FAILURE_TOPIC = keccak256("GraduationAutoAttemptFailed(address,bytes32)");

    struct FinalFillResult {
        Day4Fixture fixture;
        BreadLaunchToken token;
        BreadBondingCurve curve;
        uint256 sellable;
        uint256 spent;
    }

    function testFailedAutomaticGraduationLeavesCrossingBuySuccessfulAndReady() public {
        Day4Fixture memory f = _deployDay4Fixture(0);
        f.graduationCoordinator.setFailSweep(true);

        (uint256 sellable, uint256 spent) = _finalFillNumbers();
        uint256 quoteIn = spent + 1_000 * ONE_USDC;
        f.usdc.mint(address(this), quoteIn);
        assert(f.usdc.approve(address(f.factory), quoteIn));

        VM.recordLogs();
        (address tokenAddress, address curveAddress, uint256 tokensOut) =
            IBreadLaunchFactory(address(f.factory)).launchTokenAndBuy(
                _day4Params(f.factory.previewLaunchEconomics()), quoteIn, sellable, address(this)
            );
        BreadGraduationVm.Log[] memory logs = VM.getRecordedLogs();

        BreadBondingCurve curve = BreadBondingCurve(curveAddress);
        assert(tokensOut == sellable);
        assert(BreadLaunchToken(tokenAddress).balanceOf(address(this)) == sellable);
        assert(curve.readyToGraduate());
        assert(!curve.graduated());
        assert(_containsAutoFailure(logs, curveAddress));
    }

    function testCoordinatorOnlyReleaseExcludesDonationsAndReturnsFrozenFeeBreakdown() public {
        FinalFillResult memory r = _completeFinalFill();
        uint256 expectedSeedUsdc = r.curve.realQuoteReserve();
        uint256 expectedTokens = r.curve.trackedTokens();
        uint256 pendingBaseFee = r.curve.quoteFeeBalance();
        uint256 pendingTax = r.curve.creatorTaxBalance();
        uint256 expectedProtocolFee = pendingBaseFee * r.curve.protocolFeeShareBps() / 10_000;
        uint256 expectedCreatorFee = pendingBaseFee - expectedProtocolFee + pendingTax;

        uint256 usdcDonation = 7;
        uint256 tokenDonation = 1 ether;
        r.fixture.usdc.mint(address(this), usdcDonation);
        assert(r.fixture.usdc.transfer(address(r.curve), usdcDonation));
        assert(r.token.transfer(address(r.curve), tokenDonation));

        (bool outsiderOk,) = address(r.curve).call(
            abi.encodeWithSelector(BreadBondingCurve.releaseForGraduation.selector)
        );
        assert(!outsiderOk);

        (uint256 seedUsdc, uint256 tokenOut, uint256 protocolFeeAmount, uint256 creatorFeeAmount) =
            r.fixture.graduationCoordinator.releaseCurve(r.curve);

        assert(seedUsdc == expectedSeedUsdc);
        assert(tokenOut == expectedTokens);
        assert(protocolFeeAmount == expectedProtocolFee);
        assert(creatorFeeAmount == expectedCreatorFee);
        assert(r.curve.graduated());
        assert(r.curve.trackedQuote() == 0);
        assert(r.curve.trackedTokens() == 0);
        assert(r.fixture.usdc.balanceOf(address(r.curve)) == usdcDonation);
        assert(r.token.balanceOf(address(r.curve)) == tokenDonation);
        assert(
            r.fixture.usdc.balanceOf(address(r.fixture.graduationCoordinator))
                == expectedSeedUsdc + expectedProtocolFee + expectedCreatorFee
        );
        assert(r.token.balanceOf(address(r.fixture.graduationCoordinator)) == expectedTokens);
    }

    function _completeFinalFill() private returns (FinalFillResult memory r) {
        r.fixture = _deployDay4Fixture(0);
        (r.sellable, r.spent) = _finalFillNumbers();
        uint256 quoteIn = r.spent + 1_000 * ONE_USDC;
        r.fixture.usdc.mint(address(this), quoteIn);
        assert(r.fixture.usdc.approve(address(r.fixture.factory), quoteIn));
        (address tokenAddress, address curveAddress, uint256 tokensOut) =
            IBreadLaunchFactory(address(r.fixture.factory)).launchTokenAndBuy(
                _day4Params(r.fixture.factory.previewLaunchEconomics()), quoteIn, r.sellable, address(this)
            );
        assert(tokensOut == r.sellable);
        r.token = BreadLaunchToken(tokenAddress);
        r.curve = BreadBondingCurve(curveAddress);
        assert(r.curve.readyToGraduate());
        assert(!r.curve.graduated());
    }

    function _finalFillNumbers() private pure returns (uint256 sellable, uint256 spent) {
        uint256 reserved = DAY4_SUPPLY * DAY4_PHANTOM_QUOTE / (DAY4_PHANTOM_QUOTE + DAY4_GRADUATION_THRESHOLD);
        sellable = DAY4_SUPPLY - reserved;
        uint256 netRequired = _amountIn(sellable, DAY4_PHANTOM_QUOTE, DAY4_SUPPLY);
        spent = _ceilMulDiv(
            netRequired,
            10_000,
            10_000 - DAY4_TRADE_FEE_BPS - DAY4_CREATOR_TAX_BPS
        );
    }

    function _containsAutoFailure(BreadGraduationVm.Log[] memory logs, address curve)
        private
        pure
        returns (bool found)
    {
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter == curve && logs[i].topics.length != 0 && logs[i].topics[0] == AUTO_FAILURE_TOPIC) {
                return true;
            }
        }
    }

    function _amountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut) private pure returns (uint256) {
        return (amountOut * reserveIn * 10_000) / ((reserveOut - amountOut) * 10_000) + 1;
    }

    function _ceilMulDiv(uint256 x, uint256 y, uint256 denominator) private pure returns (uint256) {
        uint256 product = x * y;
        return product / denominator + (product % denominator == 0 ? 0 : 1);
    }
}
