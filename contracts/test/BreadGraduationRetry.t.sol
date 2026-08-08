// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../src/core/BreadBondingCurve.sol";
import {IGraduationAdapter} from "../src/interfaces/IGraduationAdapter.sol";
import {IGraduationCoordinator} from "../src/interfaces/IGraduationCoordinator.sol";
import {BreadDay5Fixture} from "./helpers/BreadDay5Fixture.sol";
import {MockPositionManagerNFT} from "./helpers/MockPositionManagerNFT.sol";

contract BreadGraduationRetryTest is BreadDay5Fixture {
    struct SweptLaunch {
        Fixture fixture;
        address token;
        BreadBondingCurve curve;
        MockPositionManagerNFT manager;
        IGraduationCoordinator.GraduationRecord record;
    }

    function testAdapterRevertLeavesSweptCustodyRetryableThenOneSuccessLocksExactlyOnePosition() public {
        SweptLaunch memory r = _sweptLaunch();
        uint256 usdcBefore = r.fixture.usdc.balanceOf(address(r.fixture.coordinator));
        uint256 tokenBefore = IERC20Like(r.token).balanceOf(address(r.fixture.coordinator));

        r.fixture.adapter.setFailAfterPull(true);
        (bool firstOk,) = address(r.fixture.coordinator).call(
            abi.encodeWithSelector(r.fixture.coordinator.createPool.selector, r.token)
        );
        assert(!firstOk);
        _assertStillSwept(r, usdcBefore, tokenBefore);
        assert(r.manager.nextTokenId() == 1);

        r.fixture.adapter.setFailAfterPull(false);
        r.fixture.adapter.setFailAfterMint(true);
        (bool secondOk,) = address(r.fixture.coordinator).call(
            abi.encodeWithSelector(r.fixture.coordinator.createPool.selector, r.token)
        );
        assert(!secondOk);
        _assertStillSwept(r, usdcBefore, tokenBefore);
        assert(r.manager.nextTokenId() == 1);

        r.fixture.adapter.setFailAfterMint(false);
        r.fixture.coordinator.createPool(r.token);

        IGraduationCoordinator.GraduationRecord memory completed = r.fixture.coordinator.getGraduation(r.token);
        assert(completed.phase == IGraduationCoordinator.GraduationPhase.POOL_CREATED);
        assert(r.fixture.adapter.successfulMints() == 1);
        assert(r.manager.nextTokenId() == 2);
        assert(r.fixture.locker.isPositionLocked(r.token));
        (address positionManager, uint256 positionId) = r.fixture.locker.lockedPosition(r.token);
        assert(positionManager == address(r.manager));
        assert(positionId == 1);
        assert(r.manager.ownerOf(positionId) == address(r.fixture.locker));

        uint256 mintsBeforeReplay = r.fixture.adapter.successfulMints();
        (bool replayOk,) = address(r.fixture.coordinator).call(
            abi.encodeWithSelector(r.fixture.coordinator.createPool.selector, r.token)
        );
        assert(!replayOk);
        assert(r.fixture.adapter.successfulMints() == mintsBeforeReplay);
    }

    function testSuccessfulStageTwoLocksExcessAndTokenDustAndCreditsUsdcDust() public {
        SweptLaunch memory r = _sweptLaunch();
        uint256 usdcDust = 3;
        uint256 tokenDust = 1 ether;
        uint256 excess = r.record.sweptTokens - r.record.poolTokenAmount;
        uint256 protocolBefore = r.fixture.escrow.balanceOf(DAY5_PROTOCOL_RECIPIENT);
        bytes32 poolId = keccak256("DAY5_POOL");

        r.fixture.adapter.setNextResult(
            IGraduationAdapter.Result({
                poolId: poolId,
                positionManager: address(0),
                positionId: 0,
                usdcUsed: r.record.sweptUsdc - usdcDust,
                tokenUsed: r.record.poolTokenAmount - tokenDust,
                usdcDust: usdcDust,
                tokenDust: tokenDust
            })
        );

        (bytes32 actualPoolId, uint256 positionId) = r.fixture.coordinator.createPool(r.token);
        IGraduationCoordinator.GraduationRecord memory completed = r.fixture.coordinator.getGraduation(r.token);

        assert(actualPoolId == poolId);
        assert(positionId == 1);
        assert(completed.phase == IGraduationCoordinator.GraduationPhase.POOL_CREATED);
        assert(completed.poolId == poolId);
        assert(completed.positionManager == address(r.manager));
        assert(completed.positionId == positionId);
        assert(completed.sweptUsdc == 0);
        assert(completed.sweptTokens == 0);
        assert(completed.poolTokenAmount == 0);
        assert(r.fixture.locker.lockedTokenSupply(r.token) == excess + tokenDust);
        assert(r.fixture.escrow.balanceOf(DAY5_PROTOCOL_RECIPIENT) == protocolBefore + usdcDust);
        assert(r.fixture.usdc.balanceOf(address(r.fixture.coordinator)) == 0);
        assert(IERC20Like(r.token).balanceOf(address(r.fixture.coordinator)) == 0);
        assert(r.fixture.coordinator.totalSweptUsdc() == 0);
    }

    function testGraduationPauseBlocksStageTwoWithoutMutation() public {
        SweptLaunch memory r = _sweptLaunch();
        uint256 usdcBefore = r.fixture.usdc.balanceOf(address(r.fixture.coordinator));
        uint256 tokenBefore = IERC20Like(r.token).balanceOf(address(r.fixture.coordinator));
        r.fixture.emergencyController.setGraduationPaused(true);

        (bool ok,) = address(r.fixture.coordinator).call(
            abi.encodeWithSelector(r.fixture.coordinator.createPool.selector, r.token)
        );

        assert(!ok);
        _assertStillSwept(r, usdcBefore, tokenBefore);
        assert(r.fixture.adapter.successfulMints() == 0);
    }

    function _sweptLaunch() private returns (SweptLaunch memory r) {
        r.fixture = _deployDay5Fixture();
        (r.token, r.curve) = _launchSwept(r.fixture);
        r.record = r.fixture.coordinator.getGraduation(r.token);
        assert(r.record.phase == IGraduationCoordinator.GraduationPhase.SWEPT);
        r.manager = new MockPositionManagerNFT();
        r.fixture.adapter.setPositionManager(r.manager);
    }

    function _assertStillSwept(SweptLaunch memory r, uint256 usdcBefore, uint256 tokenBefore) private view {
        IGraduationCoordinator.GraduationRecord memory current = r.fixture.coordinator.getGraduation(r.token);
        assert(current.phase == IGraduationCoordinator.GraduationPhase.SWEPT);
        assert(current.sweptUsdc == r.record.sweptUsdc);
        assert(current.sweptTokens == r.record.sweptTokens);
        assert(current.poolTokenAmount == r.record.poolTokenAmount);
        assert(r.fixture.usdc.balanceOf(address(r.fixture.coordinator)) == usdcBefore);
        assert(IERC20Like(r.token).balanceOf(address(r.fixture.coordinator)) == tokenBefore);
        assert(!r.fixture.locker.isPositionLocked(r.token));
    }
}

interface IERC20Like {
    function balanceOf(address account) external view returns (uint256);
}
