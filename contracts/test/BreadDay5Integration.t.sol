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

        (address token, IGraduationCoordinator.GraduationRecord memory swept) = _launchAndAssertSwept(f);
        _assertFailedCreateKeepsSwept(f, manager, token, swept);
        _createAndAssertPermanentlyLocked(f, manager, token);
    }

    function _launchAndAssertSwept(Fixture memory f)
        private
        returns (address token, IGraduationCoordinator.GraduationRecord memory swept)
    {
        (uint256 sellable, uint256 spent) = _finalFillNumbers();
        uint256 extra = 1_000 * ONE_USDC;
        uint256 quoteIn = spent + extra;
        f.usdc.mint(address(this), quoteIn);
        assert(f.usdc.approve(address(f.factory), quoteIn));

        address curveAddress;
        uint256 tokensOut;
        (token, curveAddress, tokensOut) = IBreadLaunchFactory(address(f.factory)).launchTokenAndBuy(
            _day5Params(f.factory.previewLaunchEconomics()), quoteIn, sellable, address(this)
        );
        swept = f.coordinator.getGraduation(token);

        assert(tokensOut == sellable);
        assert(BreadLaunchToken(token).balanceOf(address(this)) == sellable);
        assert(f.usdc.balanceOf(address(this)) == extra);
        assert(BreadBondingCurve(curveAddress).graduated());
        assert(swept.phase == IGraduationCoordinator.GraduationPhase.SWEPT);
        assert(swept.sweptUsdc != 0);
        assert(swept.sweptTokens != 0);
        assert(swept.poolTokenAmount != 0);
    }

    function _assertFailedCreateKeepsSwept(
        Fixture memory f,
        MockPositionManagerNFT manager,
        address token,
        IGraduationCoordinator.GraduationRecord memory swept
    ) private {
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
    }

    function _createAndAssertPermanentlyLocked(Fixture memory f, MockPositionManagerNFT manager, address token)
        private
    {
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
