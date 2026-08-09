// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {BreadBondingCurve} from "../src/core/BreadBondingCurve.sol";
import {BreadLaunchToken} from "../src/BreadLaunchToken.sol";
import {IBreadLaunchFactory} from "../src/interfaces/IBreadLaunchFactory.sol";
import {IGraduationAdapter} from "../src/interfaces/IGraduationAdapter.sol";
import {IGraduationCoordinator} from "../src/interfaces/IGraduationCoordinator.sol";
import {BreadDay5Fixture} from "./helpers/BreadDay5Fixture.sol";
import {MockGraduationAdapter} from "./helpers/MockGraduationAdapter.sol";
import {MockPositionManagerNFT} from "./helpers/MockPositionManagerNFT.sol";

contract BreadDay5InvariantTest is BreadDay5Fixture {
    struct SweptLaunch {
        Fixture fixture;
        address token;
        BreadBondingCurve curve;
        MockPositionManagerNFT manager;
        IGraduationCoordinator.GraduationRecord graduation;
    }

    function test_INV050_AtMostOneCanonicalGraduatedPoolOutcome() public {
        SweptLaunch memory s = _sweptWithManager();
        (bytes32 poolId, uint256 positionId) = s.fixture.coordinator.createPool(s.token);

        (bool createAgain,) = address(s.fixture.coordinator).call(
            abi.encodeWithSelector(s.fixture.coordinator.createPool.selector, s.token)
        );
        (bool sweepAgain,) = address(s.fixture.coordinator).call(
            abi.encodeWithSelector(s.fixture.coordinator.sweep.selector, s.token)
        );

        IGraduationCoordinator.GraduationRecord memory finalRecord = s.fixture.coordinator.getGraduation(s.token);
        assert(!createAgain);
        assert(!sweepAgain);
        assert(finalRecord.phase == IGraduationCoordinator.GraduationPhase.POOL_CREATED);
        assert(finalRecord.poolId == poolId);
        assert(finalRecord.positionId == positionId);
        assert(s.manager.nextTokenId() == 2);
        assert(s.fixture.adapter.successfulMints() == 1);
    }

    function test_INV051_ExistingLaunchUsesOnlySnapshottedAdapterAndParameters() public {
        Fixture memory f = _deployDay5Fixture();
        (address token,) = _launchReady(f);
        IBreadLaunchFactory.LaunchRecord memory frozen = f.factory.getLaunch(token);

        bytes32 replacementHash = keccak256("DAY5_REPLACEMENT_ADAPTER");
        MockGraduationAdapter replacement = new MockGraduationAdapter(
            IGraduationAdapter.AdapterFamily.UNISWAP_V4,
            address(f.usdc),
            address(f.locker),
            replacementHash
        );
        replacement.setFailValidation(true);
        replacement.setFailExecution(true);

        (IBreadLaunchFactory.LaunchConfig memory config,) = f.factory.currentLaunchConfig();
        config.graduationAdapter = address(replacement);
        config.graduationConfigHash = replacementHash;
        f.factory.setLaunchConfig(config);

        f.coordinator.sweep(token);
        MockPositionManagerNFT manager = new MockPositionManagerNFT();
        f.adapter.setPositionManager(manager);
        f.coordinator.createPool(token);

        IBreadLaunchFactory.LaunchRecord memory afterConfigChange = f.factory.getLaunch(token);
        assert(afterConfigChange.graduationAdapter == frozen.graduationAdapter);
        assert(afterConfigChange.graduationConfigHash == frozen.graduationConfigHash);
        assert(afterConfigChange.graduationAdapterFamily == frozen.graduationAdapterFamily);
        assert(f.adapter.successfulMints() == 1);
        assert(replacement.executeCalls() == 0);
    }

    function test_INV052_ValidationPrecedesIrreversibleSweep() public {
        Fixture memory f = _deployDay5Fixture();
        (address token, BreadBondingCurve curve) = _launchReady(f);
        f.adapter.setFailValidation(true);

        uint256 curveUsdc = f.usdc.balanceOf(address(curve));
        uint256 curveTokens = BreadLaunchToken(token).balanceOf(address(curve));
        uint256 coordinatorUsdc = f.usdc.balanceOf(address(f.coordinator));
        uint256 coordinatorTokens = BreadLaunchToken(token).balanceOf(address(f.coordinator));

        (bool ok,) = address(f.coordinator).call(abi.encodeWithSelector(f.coordinator.sweep.selector, token));
        IGraduationCoordinator.GraduationRecord memory record = f.coordinator.getGraduation(token);

        assert(!ok);
        assert(!curve.graduated());
        assert(curve.readyToGraduate());
        assert(record.phase == IGraduationCoordinator.GraduationPhase.NOT_GRADUATED);
        assert(f.usdc.balanceOf(address(curve)) == curveUsdc);
        assert(BreadLaunchToken(token).balanceOf(address(curve)) == curveTokens);
        assert(f.usdc.balanceOf(address(f.coordinator)) == coordinatorUsdc);
        assert(BreadLaunchToken(token).balanceOf(address(f.coordinator)) == coordinatorTokens);
    }

    function testFuzz_INV053_FailedAutoGraduationCannotRevertCrossingTrade(uint64 extraRaw) public {
        Fixture memory f = _deployDay5Fixture();
        f.adapter.setFailValidation(true);
        (uint256 sellable, uint256 spent) = _finalFillNumbers();
        uint256 extra = uint256(extraRaw) % (10_000 * ONE_USDC + 1);
        uint256 quoteIn = spent + extra;
        f.usdc.mint(address(this), quoteIn);
        assert(f.usdc.approve(address(f.factory), quoteIn));

        (address token, address curveAddress, uint256 tokensOut) = IBreadLaunchFactory(address(f.factory))
            .launchTokenAndBuy(_day5Params(f.factory.previewLaunchEconomics()), quoteIn, sellable, address(this));

        BreadBondingCurve curve = BreadBondingCurve(curveAddress);
        IGraduationCoordinator.GraduationRecord memory record = f.coordinator.getGraduation(token);
        assert(tokensOut == sellable);
        assert(BreadLaunchToken(token).balanceOf(address(this)) == sellable);
        assert(curve.readyToGraduate());
        assert(!curve.graduated());
        assert(record.phase == IGraduationCoordinator.GraduationPhase.NOT_GRADUATED);
        assert(f.usdc.balanceOf(address(this)) == extra);
    }

    function testFuzz_INV054_RetryCannotDoubleSpendOrDuplicateLiquidity(uint8 attemptsRaw) public {
        SweptLaunch memory s = _sweptWithManager();
        uint256 attempts = uint256(attemptsRaw % 5) + 1;
        uint256 usdcBefore = s.fixture.usdc.balanceOf(address(s.fixture.coordinator));
        uint256 tokenBefore = BreadLaunchToken(s.token).balanceOf(address(s.fixture.coordinator));
        s.fixture.adapter.setFailAfterMint(true);

        for (uint256 i; i < attempts; ++i) {
            (bool ok,) = address(s.fixture.coordinator).call(
                abi.encodeWithSelector(s.fixture.coordinator.createPool.selector, s.token)
            );
            assert(!ok);
            IGraduationCoordinator.GraduationRecord memory unchanged = s.fixture.coordinator.getGraduation(s.token);
            assert(unchanged.phase == IGraduationCoordinator.GraduationPhase.SWEPT);
            assert(unchanged.sweptUsdc == s.graduation.sweptUsdc);
            assert(unchanged.sweptTokens == s.graduation.sweptTokens);
            assert(s.manager.nextTokenId() == 1);
            assert(s.fixture.usdc.balanceOf(address(s.fixture.coordinator)) == usdcBefore);
            assert(BreadLaunchToken(s.token).balanceOf(address(s.fixture.coordinator)) == tokenBefore);
        }

        s.fixture.adapter.setFailAfterMint(false);
        s.fixture.coordinator.createPool(s.token);
        assert(s.manager.nextTokenId() == 2);
        assert(s.fixture.adapter.successfulMints() == 1);
        (bool replay,) = address(s.fixture.coordinator).call(
            abi.encodeWithSelector(s.fixture.coordinator.createPool.selector, s.token)
        );
        assert(!replay);
    }

    function test_INV055_SuccessAccountsForAllSweptAssetsApartFromExplicitDust() public {
        SweptLaunch memory s = _sweptWithManager();
        uint256 usdcDust = 7;
        uint256 tokenDust = 1 ether;
        uint256 protocolEscrowBefore = s.fixture.escrow.balanceOf(DAY5_PROTOCOL_RECIPIENT);
        s.fixture.adapter.setNextResult(
            IGraduationAdapter.Result({
                poolId: bytes32(0),
                positionManager: address(0),
                positionId: 0,
                usdcUsed: s.graduation.sweptUsdc - usdcDust,
                tokenUsed: s.graduation.poolTokenAmount - tokenDust,
                usdcDust: usdcDust,
                tokenDust: tokenDust
            })
        );

        s.fixture.coordinator.createPool(s.token);

        uint256 excess = s.graduation.sweptTokens - s.graduation.poolTokenAmount;
        assert(s.fixture.coordinator.totalSweptUsdc() == 0);
        assert(s.fixture.usdc.balanceOf(address(s.fixture.coordinator)) == 0);
        assert(BreadLaunchToken(s.token).balanceOf(address(s.fixture.coordinator)) == 0);
        assert(s.fixture.usdc.balanceOf(address(s.fixture.adapter)) == s.graduation.sweptUsdc - usdcDust);
        assert(BreadLaunchToken(s.token).balanceOf(address(s.fixture.adapter)) == s.graduation.poolTokenAmount - tokenDust);
        assert(s.fixture.locker.lockedTokenSupply(s.token) == excess + tokenDust);
        assert(BreadLaunchToken(s.token).balanceOf(address(s.fixture.locker)) == excess + tokenDust);
        assert(s.fixture.escrow.balanceOf(DAY5_PROTOCOL_RECIPIENT) == protocolEscrowBefore + usdcDust);
        assert(
            s.fixture.usdc.balanceOf(address(s.fixture.adapter)) + usdcDust == s.graduation.sweptUsdc
        );
        assert(
            BreadLaunchToken(s.token).balanceOf(address(s.fixture.adapter))
                + BreadLaunchToken(s.token).balanceOf(address(s.fixture.locker)) == s.graduation.sweptTokens
        );
    }

    function test_INV056_LockerHasNoPrincipalEscapeAfterGraduation() public {
        SweptLaunch memory s = _sweptWithManager();
        s.fixture.coordinator.createPool(s.token);
        (address positionManager, uint256 positionId) = s.fixture.locker.lockedPosition(s.token);
        uint256 lockedTokens = s.fixture.locker.lockedTokenSupply(s.token);
        uint256 tokenBalance = BreadLaunchToken(s.token).balanceOf(address(s.fixture.locker));

        bytes[5] memory calls = [
            abi.encodeWithSignature("withdraw(address,uint256)", s.token, lockedTokens),
            abi.encodeWithSignature("rescueToken(address,address,uint256)", s.token, address(this), lockedTokens),
            abi.encodeWithSignature("execute(address,bytes)", s.token, bytes("")),
            abi.encodeWithSignature("transferPosition(address,uint256,address)", positionManager, positionId, address(this)),
            abi.encodeWithSignature("upgradeTo(address)", address(this))
        ];
        for (uint256 i; i < calls.length; ++i) {
            (bool ok,) = address(s.fixture.locker).call(calls[i]);
            assert(!ok);
        }

        (address positionManagerAfter, uint256 positionIdAfter) = s.fixture.locker.lockedPosition(s.token);
        assert(positionManagerAfter == positionManager);
        assert(positionIdAfter == positionId);
        assert(s.manager.ownerOf(positionId) == address(s.fixture.locker));
        assert(s.fixture.locker.lockedTokenSupply(s.token) == lockedTokens);
        assert(BreadLaunchToken(s.token).balanceOf(address(s.fixture.locker)) == tokenBalance);
    }

    function _sweptWithManager() private returns (SweptLaunch memory s) {
        s.fixture = _deployDay5Fixture();
        (s.token, s.curve) = _launchSwept(s.fixture);
        s.manager = new MockPositionManagerNFT();
        s.fixture.adapter.setPositionManager(s.manager);
        s.graduation = s.fixture.coordinator.getGraduation(s.token);
        assert(s.graduation.phase == IGraduationCoordinator.GraduationPhase.SWEPT);
    }
}
