// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../src/core/BreadBondingCurve.sol";
import {BreadLaunchToken} from "../src/BreadLaunchToken.sol";
import {IBreadLaunchFactory} from "../src/interfaces/IBreadLaunchFactory.sol";
import {IGraduationCoordinator} from "../src/interfaces/IGraduationCoordinator.sol";
import {BreadDay5Fixture} from "./helpers/BreadDay5Fixture.sol";

contract BreadGraduationCoordinatorTest is BreadDay5Fixture {
    struct ReadyLaunch {
        Fixture fixture;
        address token;
        BreadBondingCurve curve;
        uint256 sellable;
        uint256 spent;
    }

    function testUnknownLaunchCannotSweep() public {
        Fixture memory f = _deployDay5Fixture();
        (bool ok,) = address(f.coordinator).call(
            abi.encodeWithSelector(f.coordinator.sweep.selector, address(0x1234))
        );
        assert(!ok);
    }

    function testLaunchMustBeReadyBeforeSweep() public {
        Fixture memory f = _deployDay5Fixture();
        (address token, address curveAddress) = f.factory.launchToken(_day5Params(f.factory.previewLaunchEconomics()));
        assert(!BreadBondingCurve(curveAddress).readyToGraduate());

        (bool ok,) = address(f.coordinator).call(
            abi.encodeWithSelector(f.coordinator.sweep.selector, token)
        );
        assert(!ok);
        assert(!BreadBondingCurve(curveAddress).graduated());
    }

    function testGraduationPauseBlocksSweepBeforeFinancialMutation() public {
        ReadyLaunch memory r = _readyLaunch();
        uint256 coordinatorUsdcBefore = r.fixture.usdc.balanceOf(address(r.fixture.coordinator));
        uint256 coordinatorTokenBefore = BreadLaunchToken(r.token).balanceOf(address(r.fixture.coordinator));
        uint256 curveUsdcBefore = r.fixture.usdc.balanceOf(address(r.curve));
        uint256 curveTokenBefore = BreadLaunchToken(r.token).balanceOf(address(r.curve));

        r.fixture.emergencyController.setGraduationPaused(true);
        (bool ok,) = address(r.fixture.coordinator).call(
            abi.encodeWithSelector(r.fixture.coordinator.sweep.selector, r.token)
        );

        assert(!ok);
        assert(!r.curve.graduated());
        assert(r.fixture.usdc.balanceOf(address(r.fixture.coordinator)) == coordinatorUsdcBefore);
        assert(BreadLaunchToken(r.token).balanceOf(address(r.fixture.coordinator)) == coordinatorTokenBefore);
        assert(r.fixture.usdc.balanceOf(address(r.curve)) == curveUsdcBefore);
        assert(BreadLaunchToken(r.token).balanceOf(address(r.curve)) == curveTokenBefore);
    }

    function testAdapterPreflightFailureOccursBeforeCurveRelease() public {
        ReadyLaunch memory r = _readyLaunch();
        r.fixture.adapter.setFailValidation(true);
        uint256 trackedQuoteBefore = r.curve.trackedQuote();
        uint256 trackedTokensBefore = r.curve.trackedTokens();

        (bool ok,) = address(r.fixture.coordinator).call(
            abi.encodeWithSelector(r.fixture.coordinator.sweep.selector, r.token)
        );

        assert(!ok);
        assert(!r.curve.graduated());
        assert(r.curve.trackedQuote() == trackedQuoteBefore);
        assert(r.curve.trackedTokens() == trackedTokensBefore);
        assert(r.fixture.usdc.balanceOf(address(r.fixture.coordinator)) == 0);
        assert(BreadLaunchToken(r.token).balanceOf(address(r.fixture.coordinator)) == 0);
    }

    function testSuccessfulSweepCreditsCanonicalEscrowAndRecordsExactSeedCustody() public {
        ReadyLaunch memory r = _readyLaunch();
        uint256 seedUsdc = r.curve.realQuoteReserve();
        uint256 sweptTokens = r.curve.trackedTokens();
        uint256 pendingBaseFee = r.curve.quoteFeeBalance();
        uint256 pendingTax = r.curve.creatorTaxBalance();
        uint256 protocolFee = pendingBaseFee * r.curve.protocolFeeShareBps() / 10_000;
        uint256 creatorFee = pendingBaseFee - protocolFee + pendingTax;
        uint256 expectedPoolTokens = sweptTokens * seedUsdc / (seedUsdc + r.curve.phantomQuote());

        r.fixture.coordinator.sweep(r.token);
        IGraduationCoordinator.GraduationRecord memory g = r.fixture.coordinator.getGraduation(r.token);

        assert(g.phase == IGraduationCoordinator.GraduationPhase.SWEPT);
        assert(g.sweptUsdc == seedUsdc);
        assert(g.sweptTokens == sweptTokens);
        assert(g.poolTokenAmount == expectedPoolTokens);
        assert(g.sweptAt != 0);
        assert(r.curve.graduated());
        assert(r.fixture.usdc.balanceOf(address(r.fixture.coordinator)) == seedUsdc);
        assert(BreadLaunchToken(r.token).balanceOf(address(r.fixture.coordinator)) == sweptTokens);
        assert(r.fixture.escrow.balanceOf(DAY5_PROTOCOL_RECIPIENT) == protocolFee);
        assert(r.fixture.escrow.balanceOf(address(this)) == creatorFee);
        assert(r.fixture.escrow.totalOutstanding() == protocolFee + creatorFee);
    }

    function testDonationsCannotEnterRecordedGraduationSeed() public {
        ReadyLaunch memory r = _readyLaunch();
        uint256 expectedSeedUsdc = r.curve.realQuoteReserve();
        uint256 expectedTokens = r.curve.trackedTokens();
        uint256 usdcDonation = 7;
        uint256 tokenDonation = 1 ether;
        r.fixture.usdc.mint(address(this), usdcDonation);
        assert(r.fixture.usdc.transfer(address(r.curve), usdcDonation));
        assert(BreadLaunchToken(r.token).transfer(address(r.curve), tokenDonation));

        r.fixture.coordinator.sweep(r.token);
        IGraduationCoordinator.GraduationRecord memory g = r.fixture.coordinator.getGraduation(r.token);

        assert(g.sweptUsdc == expectedSeedUsdc);
        assert(g.sweptTokens == expectedTokens);
        assert(r.fixture.usdc.balanceOf(address(r.curve)) == usdcDonation);
        assert(BreadLaunchToken(r.token).balanceOf(address(r.curve)) == tokenDonation);
    }

    function testSecondSweepCannotReplayOrMoveAssets() public {
        ReadyLaunch memory r = _readyLaunch();
        r.fixture.coordinator.sweep(r.token);
        uint256 usdcBefore = r.fixture.usdc.balanceOf(address(r.fixture.coordinator));
        uint256 tokenBefore = BreadLaunchToken(r.token).balanceOf(address(r.fixture.coordinator));
        IGraduationCoordinator.GraduationRecord memory beforeRecord = r.fixture.coordinator.getGraduation(r.token);

        (bool ok,) = address(r.fixture.coordinator).call(
            abi.encodeWithSelector(r.fixture.coordinator.sweep.selector, r.token)
        );

        assert(!ok);
        assert(r.fixture.usdc.balanceOf(address(r.fixture.coordinator)) == usdcBefore);
        assert(BreadLaunchToken(r.token).balanceOf(address(r.fixture.coordinator)) == tokenBefore);
        IGraduationCoordinator.GraduationRecord memory afterRecord = r.fixture.coordinator.getGraduation(r.token);
        assert(afterRecord.phase == beforeRecord.phase);
        assert(afterRecord.sweptUsdc == beforeRecord.sweptUsdc);
        assert(afterRecord.sweptTokens == beforeRecord.sweptTokens);
    }

    function _readyLaunch() private returns (ReadyLaunch memory r) {
        r.fixture = _deployDay5Fixture();
        (r.sellable, r.spent) = _finalFillNumbers();
        uint256 quoteIn = r.spent + 1_000 * ONE_USDC;
        r.fixture.usdc.mint(address(this), quoteIn);
        assert(r.fixture.usdc.approve(address(r.fixture.factory), quoteIn));

        (r.token, address curveAddress, uint256 tokensOut) =
            IBreadLaunchFactory(address(r.fixture.factory)).launchTokenAndBuy(
                _day5Params(r.fixture.factory.previewLaunchEconomics()), quoteIn, r.sellable, address(this)
            );
        assert(tokensOut == r.sellable);
        r.curve = BreadBondingCurve(curveAddress);
        assert(r.curve.readyToGraduate());
        assert(!r.curve.graduated());
    }
}
