// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../src/core/BreadBondingCurve.sol";
import {BreadLaunchToken} from "../src/BreadLaunchToken.sol";
import {IBreadLaunchFactory} from "../src/interfaces/IBreadLaunchFactory.sol";
import {IGraduationCoordinator} from "../src/interfaces/IGraduationCoordinator.sol";
import {BreadDay5Fixture} from "./helpers/BreadDay5Fixture.sol";
import {MockPositionManagerNFT} from "./helpers/MockPositionManagerNFT.sol";

contract BreadDay5IntegrationTest is BreadDay5Fixture {
    function testAtomicLaunchBuyAutoSweepsThenRetryablePoolCreationPermanentlyLocks() public {
        Fixture memory f = _deployDay5Fixture();
        MockPositionManagerNFT manager = new MockPositionManagerNFT();
        f.adapter.setPositionManager(manager);

        (uint256 sellable, uint256 spent) = _finalFillNumbers();
        uint256 extra = 1_000 * ONE_USDC;
        uint256 quoteIn = spent + extra;
        f.usdc.mint(address(this), quoteIn);
        assert(f.usdc.approve(address(f.factory), quoteIn));

        (address token, address curveAddress, uint256 tokensOut) =
            IBreadLaunchFactory(address(f.factory)).launchTokenAndBuy(
                _day5Params(f.factory.previewLaunchEconomics()), quoteIn, sellable, address(this)
            );
        BreadBondingCurve curve = BreadBondingCurve(curveAddress);
        IGraduationCoordinator.GraduationRecord memory swept = f.coordinator.getGraduation(token);

        assert(tokensOut == sellable);
        assert(BreadLaunchToken(token).balanceOf(address(this)) == sellable);
        assert(f.usdc.balanceOf(address(this)) == extra);
        assert(curve.graduated());
        assert(swept.phase == IGraduationCoordinator.GraduationPhase.SWEPT);
        assert(swept.sweptUsdc != 0);
        assert(swept.sweptTokens != 0);
        assert(swept.poolTokenAmount != 0);

        f.adapter.setFailAfterMint(true);
        (bool failedCreate,) = address(f.coordinator).call(
            abi.encodeWithSelector(f.coordinator.createPool.selector, token)
        );
        assert(!failedCreate);
        IGraduationCoordinator.GraduationRecord memory afterFailure = f.coordinator.getGraduation(token);
        assert(afterFailure.phase == IGraduationCoordinator.GraduationPhase.SWEPT);
        assert(afterFailure.sweptUsdc == swept.sweptUsdc);
        assert(afterFailure.sweptTokens == swept.sweptTokens);
        assert(manager.nextTokenId() == 1);

        f.adapter.setFailAfterMint(false);
        (bytes32 poolId, uint256 positionId) = f.coordinator.createPool(token);
        IGraduationCoordinator.GraduationRecord memory completed = f.coordinator.getGraduation(token);

        assert(poolId != bytes32(0));
        assert(positionId == 1);
        assert(completed.phase == IGraduationCoordinator.GraduationPhase.POOL_CREATED);
        assert(completed.poolId == poolId);
        assert(completed.positionManager == address(manager));
        assert(completed.positionId == positionId);
        assert(f.locker.isPositionLocked(token));
        assert(manager.ownerOf(positionId) == address(f.locker));
        assert(f.usdc.balanceOf(address(f.coordinator)) == 0);
        assert(BreadLaunchToken(token).balanceOf(address(f.coordinator)) == 0);
        assert(f.coordinator.totalSweptUsdc() == 0);
        assert(f.adapter.successfulMints() == 1);
    }
}
