// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {BreadBondingCurve} from "../core/BreadBondingCurve.sol";
import {BreadPermanentLiquidityLocker} from "./BreadPermanentLiquidityLocker.sol";
import {IBreadEmergencyController} from "../interfaces/IBreadEmergencyController.sol";
import {IBreadFeeEscrow} from "../interfaces/IBreadFeeEscrow.sol";
import {IBreadLaunchFactory} from "../interfaces/IBreadLaunchFactory.sol";
import {IGraduationAdapter} from "../interfaces/IGraduationAdapter.sol";
import {IGraduationCoordinator} from "../interfaces/IGraduationCoordinator.sol";

/// @title GraduationCoordinator
/// @notice Canonical Bread graduation phase and custody authority.
contract GraduationCoordinator is Ownable, ReentrancyGuard, IGraduationCoordinator {
    using SafeERC20 for IERC20;

    uint256 public constant GRADUATION_RESCUE_DELAY = 7 days;

    error ZeroAddress();
    error TokenNotFound();
    error WrongGraduationPhase();
    error GraduationPaused();
    error CurveNotReady();
    error GraduationCoordinatorMismatch();
    error GraduationAdapterInvalid();
    error GraduationSeedNotViable();
    error GraduationTransferMismatch();
    error StageTwoNotImplemented();

    address public immutable override factory;
    address public immutable override usdc;
    address public immutable override feeEscrow;
    address public immutable override emergencyController;
    BreadPermanentLiquidityLocker public immutable permanentLocker;

    uint256 public totalSweptUsdc;

    mapping(address token => GraduationRecord record) private _graduations;

    event GraduationSwept(
        address indexed token,
        address indexed adapter,
        uint256 usdcAmount,
        uint256 tokenAmount,
        uint64 sweptAt
    );

    constructor(
        address protocolAdmin_,
        address factory_,
        address usdc_,
        address feeEscrow_,
        address emergencyController_,
        BreadPermanentLiquidityLocker locker_
    ) Ownable(protocolAdmin_) {
        if (
            protocolAdmin_ == address(0) || factory_ == address(0) || usdc_ == address(0) || feeEscrow_ == address(0)
                || emergencyController_ == address(0) || address(locker_) == address(0)
        ) revert ZeroAddress();

        factory = factory_;
        usdc = usdc_;
        feeEscrow = feeEscrow_;
        emergencyController = emergencyController_;
        permanentLocker = locker_;
    }

    function locker() external view override returns (address) {
        return address(permanentLocker);
    }

    /// @notice Permissionlessly validates and moves one ready curve into exact coordinator custody.
    function sweep(address token) external override nonReentrant {
        IBreadLaunchFactory.LaunchRecord memory launch = IBreadLaunchFactory(factory).getLaunch(token);
        if (launch.token != token || launch.curve == address(0)) revert TokenNotFound();

        GraduationRecord storage graduation = _graduations[token];
        if (graduation.phase != GraduationPhase.NOT_GRADUATED) revert WrongGraduationPhase();
        if (IBreadEmergencyController(emergencyController).graduationPaused()) revert GraduationPaused();
        if (launch.graduationCoordinator != address(this)) revert GraduationCoordinatorMismatch();

        BreadBondingCurve curve = BreadBondingCurve(launch.curve);
        if (curve.token() != token || curve.pairToken() != usdc || !curve.readyToGraduate()) revert CurveNotReady();

        IGraduationAdapter adapter = _validatedAdapter(launch);
        uint256 expectedSeedUsdc = curve.realQuoteReserve();
        uint256 expectedTokens = curve.tokenReserve();
        uint256 virtualQuote = expectedSeedUsdc + curve.phantomQuote();
        if (expectedSeedUsdc == 0 || expectedTokens == 0 || virtualQuote == 0) revert GraduationSeedNotViable();
        uint256 poolTokenAmount = Math.mulDiv(expectedTokens, expectedSeedUsdc, virtualQuote);
        if (poolTokenAmount == 0 || poolTokenAmount > expectedTokens) revert GraduationSeedNotViable();

        IGraduationAdapter.Seed memory seed = IGraduationAdapter.Seed({
            token: token,
            usdc: usdc,
            usdcAmount: expectedSeedUsdc,
            totalTokenAmount: expectedTokens,
            poolTokenAmount: poolTokenAmount,
            configHash: launch.graduationConfigHash
        });
        adapter.validateSeed(seed);

        IERC20 quote = IERC20(usdc);
        IERC20 launchToken = IERC20(token);
        uint256 usdcBefore = quote.balanceOf(address(this));
        uint256 tokenBefore = launchToken.balanceOf(address(this));

        (
            uint256 seedUsdc,
            uint256 tokenOut,
            uint256 protocolFeeAmount,
            uint256 creatorFeeAmount
        ) = curve.releaseForGraduation();

        uint256 receivedUsdc = quote.balanceOf(address(this)) - usdcBefore;
        uint256 receivedTokens = launchToken.balanceOf(address(this)) - tokenBefore;
        if (
            seedUsdc != expectedSeedUsdc || tokenOut != expectedTokens || receivedTokens != tokenOut
                || receivedUsdc != seedUsdc + protocolFeeAmount + creatorFeeAmount
        ) revert GraduationTransferMismatch();

        _creditFee(quote, curve.protocolFeeRecipient(), protocolFeeAmount);
        _creditFee(quote, curve.creatorFeeRecipient(), creatorFeeAmount);

        if (quote.balanceOf(address(this)) - usdcBefore != seedUsdc) revert GraduationTransferMismatch();
        if (launchToken.balanceOf(address(this)) - tokenBefore != tokenOut) revert GraduationTransferMismatch();

        uint64 sweptAt = uint64(block.timestamp);
        graduation.phase = GraduationPhase.SWEPT;
        graduation.sweptAt = sweptAt;
        graduation.sweptUsdc = seedUsdc;
        graduation.sweptTokens = tokenOut;
        graduation.poolTokenAmount = poolTokenAmount;
        totalSweptUsdc += seedUsdc;

        emit GraduationSwept(token, launch.graduationAdapter, seedUsdc, tokenOut, sweptAt);
    }

    /// @dev Stage 2 is intentionally unavailable until the retry/lock RED suite is committed.
    function createPool(address) external pure override returns (bytes32, uint256) {
        revert StageTwoNotImplemented();
    }

    function getGraduation(address token) external view override returns (GraduationRecord memory record) {
        return _graduations[token];
    }

    function _validatedAdapter(IBreadLaunchFactory.LaunchRecord memory launch)
        private
        view
        returns (IGraduationAdapter adapter)
    {
        if (launch.graduationAdapter.code.length == 0 || launch.graduationConfigHash == bytes32(0)) {
            revert GraduationAdapterInvalid();
        }

        adapter = IGraduationAdapter(launch.graduationAdapter);
        if (
            adapter.family() == IGraduationAdapter.AdapterFamily.NONE
                || adapter.family() != launch.graduationAdapterFamily || adapter.usdc() != usdc
                || adapter.locker() != address(permanentLocker) || adapter.configHash() != launch.graduationConfigHash
        ) revert GraduationAdapterInvalid();
    }

    function _creditFee(IERC20 quote, address recipient, uint256 amount) private {
        if (amount == 0) return;
        quote.forceApprove(feeEscrow, amount);
        IBreadFeeEscrow(feeEscrow).credit(recipient, amount);
        quote.forceApprove(feeEscrow, 0);
    }
}
