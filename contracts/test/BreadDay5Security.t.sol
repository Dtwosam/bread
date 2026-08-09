// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../src/core/BreadBondingCurve.sol";
import {BreadLaunchToken} from "../src/BreadLaunchToken.sol";
import {IGraduationAdapter} from "../src/interfaces/IGraduationAdapter.sol";
import {IGraduationCoordinator} from "../src/interfaces/IGraduationCoordinator.sol";
import {BreadDay5Fixture} from "./helpers/BreadDay5Fixture.sol";
import {MockPositionManagerNFT} from "./helpers/MockPositionManagerNFT.sol";

contract BreadDay5SecurityTest is BreadDay5Fixture {
    struct SweptPair {
        Fixture fixture;
        address tokenA;
        address tokenB;
        IGraduationCoordinator.GraduationRecord a;
        IGraduationCoordinator.GraduationRecord b;
        MockPositionManagerNFT manager;
    }

    function testTwoSweptLaunchesAndCoordinatorDonationStayIsolatedWhenACompletes() public {
        SweptPair memory p = _twoSweptLaunches();
        uint256 donation = 11;
        p.fixture.usdc.mint(address(this), donation);
        assert(p.fixture.usdc.transfer(address(p.fixture.coordinator), donation));

        uint256 tokenBBefore = BreadLaunchToken(p.tokenB).balanceOf(address(p.fixture.coordinator));
        uint256 expectedUsdcAfter = p.b.sweptUsdc + donation;
        p.fixture.coordinator.createPool(p.tokenA);

        IGraduationCoordinator.GraduationRecord memory aAfter = p.fixture.coordinator.getGraduation(p.tokenA);
        IGraduationCoordinator.GraduationRecord memory bAfter = p.fixture.coordinator.getGraduation(p.tokenB);
        assert(aAfter.phase == IGraduationCoordinator.GraduationPhase.POOL_CREATED);
        assert(bAfter.phase == IGraduationCoordinator.GraduationPhase.SWEPT);
        assert(bAfter.sweptUsdc == p.b.sweptUsdc);
        assert(bAfter.sweptTokens == p.b.sweptTokens);
        assert(p.fixture.coordinator.totalSweptUsdc() == p.b.sweptUsdc);
        assert(p.fixture.usdc.balanceOf(address(p.fixture.coordinator)) == expectedUsdcAfter);
        assert(BreadLaunchToken(p.tokenB).balanceOf(address(p.fixture.coordinator)) == tokenBBefore);
        assert(p.manager.nextTokenId() == 2);
    }

    function testFeeEscrowAuthorizationFailureRollsSweepBackExactly() public {
        Fixture memory f = _deployDay5Fixture();
        (address token, BreadBondingCurve curve) = _launchReady(f);
        uint256 curveUsdcBefore = f.usdc.balanceOf(address(curve));
        uint256 curveTokenBefore = BreadLaunchToken(token).balanceOf(address(curve));
        uint256 coordinatorUsdcBefore = f.usdc.balanceOf(address(f.coordinator));
        uint256 coordinatorTokenBefore = BreadLaunchToken(token).balanceOf(address(f.coordinator));

        f.escrow.setAuthorizedCreditor(address(f.coordinator), false);
        (bool ok,) = address(f.coordinator).call(abi.encodeWithSelector(f.coordinator.sweep.selector, token));
        IGraduationCoordinator.GraduationRecord memory record = f.coordinator.getGraduation(token);

        assert(!ok);
        assert(record.phase == IGraduationCoordinator.GraduationPhase.NOT_GRADUATED);
        assert(curve.readyToGraduate());
        assert(!curve.graduated());
        assert(f.usdc.balanceOf(address(curve)) == curveUsdcBefore);
        assert(BreadLaunchToken(token).balanceOf(address(curve)) == curveTokenBefore);
        assert(f.usdc.balanceOf(address(f.coordinator)) == coordinatorUsdcBefore);
        assert(BreadLaunchToken(token).balanceOf(address(f.coordinator)) == coordinatorTokenBefore);
        assert(f.usdc.allowance(address(f.coordinator), address(f.escrow)) == 0);
    }

    function testMalformedAdapterResultRollsStageTwoBackToSwept() public {
        Fixture memory f = _deployDay5Fixture();
        (address token,) = _launchSwept(f);
        MockPositionManagerNFT manager = new MockPositionManagerNFT();
        f.adapter.setPositionManager(manager);
        IGraduationCoordinator.GraduationRecord memory beforeRecord = f.coordinator.getGraduation(token);
        uint256 usdcBefore = f.usdc.balanceOf(address(f.coordinator));
        uint256 tokenBefore = BreadLaunchToken(token).balanceOf(address(f.coordinator));

        f.adapter.setNextResult(
            IGraduationAdapter.Result({
                poolId: keccak256("MALFORMED"),
                positionManager: address(manager),
                positionId: 77,
                usdcUsed: beforeRecord.sweptUsdc + 1,
                tokenUsed: beforeRecord.poolTokenAmount,
                usdcDust: 0,
                tokenDust: 0
            })
        );
        (bool ok,) = address(f.coordinator).call(abi.encodeWithSelector(f.coordinator.createPool.selector, token));

        IGraduationCoordinator.GraduationRecord memory afterRecord = f.coordinator.getGraduation(token);
        assert(!ok);
        assert(afterRecord.phase == IGraduationCoordinator.GraduationPhase.SWEPT);
        assert(afterRecord.sweptUsdc == beforeRecord.sweptUsdc);
        assert(afterRecord.sweptTokens == beforeRecord.sweptTokens);
        assert(afterRecord.poolTokenAmount == beforeRecord.poolTokenAmount);
        assert(f.usdc.balanceOf(address(f.coordinator)) == usdcBefore);
        assert(BreadLaunchToken(token).balanceOf(address(f.coordinator)) == tokenBefore);
        assert(manager.nextTokenId() == 1);
        assert(f.usdc.allowance(address(f.coordinator), address(f.adapter)) == 0);
        assert(BreadLaunchToken(token).allowance(address(f.coordinator), address(f.adapter)) == 0);
    }

    function testAdapterReentrancyIsRejectedWithoutBreakingOuterGraduation() public {
        Fixture memory f = _deployDay5Fixture();
        (address token,) = _launchSwept(f);
        MockPositionManagerNFT manager = new MockPositionManagerNFT();
        f.adapter.setPositionManager(manager);
        f.adapter.setReentry(address(f.coordinator), token, true);

        f.coordinator.createPool(token);
        IGraduationCoordinator.GraduationRecord memory record = f.coordinator.getGraduation(token);

        assert(record.phase == IGraduationCoordinator.GraduationPhase.POOL_CREATED);
        assert(f.adapter.reentryAttempted());
        assert(!f.adapter.reentrySucceeded());
        assert(f.adapter.successfulMints() == 1);
        assert(manager.nextTokenId() == 2);
        assert(f.usdc.allowance(address(f.coordinator), address(f.adapter)) == 0);
        assert(BreadLaunchToken(token).allowance(address(f.coordinator), address(f.adapter)) == 0);
    }

    function testAdapterFailureAfterPullLeavesSweptAndZeroAllowancesThenRetrySucceeds() public {
        Fixture memory f = _deployDay5Fixture();
        (address token,) = _launchSwept(f);
        MockPositionManagerNFT manager = new MockPositionManagerNFT();
        f.adapter.setPositionManager(manager);
        IGraduationCoordinator.GraduationRecord memory beforeRecord = f.coordinator.getGraduation(token);
        uint256 usdcBefore = f.usdc.balanceOf(address(f.coordinator));
        uint256 tokenBefore = BreadLaunchToken(token).balanceOf(address(f.coordinator));

        f.adapter.setFailAfterPull(true);
        (bool failed,) = address(f.coordinator).call(abi.encodeWithSelector(f.coordinator.createPool.selector, token));
        assert(!failed);
        IGraduationCoordinator.GraduationRecord memory afterFailure = f.coordinator.getGraduation(token);
        assert(afterFailure.phase == IGraduationCoordinator.GraduationPhase.SWEPT);
        assert(afterFailure.sweptUsdc == beforeRecord.sweptUsdc);
        assert(afterFailure.sweptTokens == beforeRecord.sweptTokens);
        assert(f.usdc.balanceOf(address(f.coordinator)) == usdcBefore);
        assert(BreadLaunchToken(token).balanceOf(address(f.coordinator)) == tokenBefore);
        assert(f.usdc.allowance(address(f.coordinator), address(f.adapter)) == 0);
        assert(BreadLaunchToken(token).allowance(address(f.coordinator), address(f.adapter)) == 0);

        f.adapter.setFailAfterPull(false);
        f.coordinator.createPool(token);
        assert(f.coordinator.getGraduation(token).phase == IGraduationCoordinator.GraduationPhase.POOL_CREATED);
        assert(f.adapter.successfulMints() == 1);
        assert(manager.nextTokenId() == 2);
        assert(f.usdc.allowance(address(f.coordinator), address(f.adapter)) == 0);
        assert(BreadLaunchToken(token).allowance(address(f.coordinator), address(f.adapter)) == 0);
    }

    function _twoSweptLaunches() private returns (SweptPair memory p) {
        p.fixture = _deployDay5Fixture();
        (p.tokenA,) = _launchSwept(p.fixture);
        (p.tokenB,) = _launchSwept(p.fixture);
        p.a = p.fixture.coordinator.getGraduation(p.tokenA);
        p.b = p.fixture.coordinator.getGraduation(p.tokenB);
        p.manager = new MockPositionManagerNFT();
        p.fixture.adapter.setPositionManager(p.manager);
        assert(p.a.phase == IGraduationCoordinator.GraduationPhase.SWEPT);
        assert(p.b.phase == IGraduationCoordinator.GraduationPhase.SWEPT);
        assert(p.fixture.coordinator.totalSweptUsdc() == p.a.sweptUsdc + p.b.sweptUsdc);
    }
}
