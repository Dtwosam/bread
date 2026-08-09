// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {BreadBondingCurve} from "../src/core/BreadBondingCurve.sol";
import {BreadFeeEscrow} from "../src/fees/BreadFeeEscrow.sol";
import {BreadPermanentLiquidityLocker} from "../src/graduation/BreadPermanentLiquidityLocker.sol";
import {GraduationCoordinator} from "../src/graduation/GraduationCoordinator.sol";
import {IBreadLaunchFactory} from "../src/interfaces/IBreadLaunchFactory.sol";
import {IGraduationCoordinator} from "../src/interfaces/IGraduationCoordinator.sol";

interface BreadSmokeVm {
    function envAddress(string calldata name) external returns (address value);
    function envUint(string calldata name) external returns (uint256 value);
    function addr(uint256 privateKey) external returns (address keyAddr);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract SmokeDay5Graduation {
    BreadSmokeVm private constant VM = BreadSmokeVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    error InvalidPrivateKeyOwner();
    error InvalidSmokeInput();
    error SmokeApprovalFailed();
    error GraduationDidNotComplete();
    error PositionNotPermanentlyLocked();
    error GraduationResidueNotReconciled();
    error CreatorClaimPathMissing();
    error CreatorClaimMismatch();
    error ReplayUnexpectedlySucceeded();

    struct SmokeContext {
        IBreadLaunchFactory factory;
        GraduationCoordinator coordinator;
        BreadPermanentLiquidityLocker locker;
        IERC20 usdc;
        BreadFeeEscrow feeEscrow;
        address operator;
    }

    struct SmokeInput {
        uint256 quoteIn;
        uint256 minTokensOut;
        uint16 creatorTaxBps;
    }

    struct LaunchResult {
        address token;
        address curve;
    }

    event Day5SmokePass(
        address indexed token,
        address indexed curve,
        bytes32 indexed poolId,
        uint256 positionId,
        uint256 creatorClaimed
    );

    function run() external {
        uint256 privateKey = VM.envUint("BREAD_SMOKE_PRIVATE_KEY");
        address operator = VM.addr(privateKey);
        if (operator != VM.envAddress("BREAD_SMOKE_OPERATOR")) revert InvalidPrivateKeyOwner();

        SmokeContext memory context = _readContext(operator);
        SmokeInput memory input = _readInput();
        _validateFunding(context, input);

        VM.startBroadcast(privateKey);
        LaunchResult memory launch = _launch(context, input);
        IGraduationCoordinator.GraduationRecord memory graduation = _completeGraduation(context, launch);
        uint256 creatorClaimed = _claimCreatorFees(context);
        _assertReplayRejected(context.coordinator, launch.token);
        VM.stopBroadcast();

        emit Day5SmokePass(
            launch.token,
            launch.curve,
            graduation.poolId,
            graduation.positionId,
            creatorClaimed
        );
    }

    function _readContext(address operator) private returns (SmokeContext memory context) {
        context.factory = IBreadLaunchFactory(VM.envAddress("BREAD_FACTORY"));
        context.coordinator = GraduationCoordinator(VM.envAddress("BREAD_GRADUATION_COORDINATOR"));
        context.locker = BreadPermanentLiquidityLocker(VM.envAddress("BREAD_PERMANENT_LIQUIDITY_LOCKER"));
        context.usdc = IERC20(VM.envAddress("BREAD_USDC"));
        context.feeEscrow = BreadFeeEscrow(context.coordinator.feeEscrow());
        context.operator = operator;
    }

    function _readInput() private returns (SmokeInput memory input) {
        uint256 creatorTaxRaw = VM.envUint("BREAD_SMOKE_CREATOR_TAX_BPS");
        input.quoteIn = VM.envUint("BREAD_SMOKE_QUOTE_IN");
        input.minTokensOut = VM.envUint("BREAD_SMOKE_MIN_TOKENS_OUT");
        if (
            input.quoteIn == 0 || input.minTokensOut == 0 || creatorTaxRaw == 0
                || creatorTaxRaw > type(uint16).max
        ) revert InvalidSmokeInput();
        input.creatorTaxBps = uint16(creatorTaxRaw);
    }

    function _validateFunding(SmokeContext memory context, SmokeInput memory input) private view {
        (IBreadLaunchFactory.LaunchConfig memory config,) = context.factory.currentLaunchConfig();
        uint256 totalApproval = config.launchFeeUsdc + input.quoteIn;
        if (context.usdc.balanceOf(context.operator) < totalApproval) revert InvalidSmokeInput();
    }

    function _launch(SmokeContext memory context, SmokeInput memory input)
        private
        returns (LaunchResult memory launch)
    {
        (IBreadLaunchFactory.LaunchConfig memory config,) = context.factory.currentLaunchConfig();
        uint256 totalApproval = config.launchFeeUsdc + input.quoteIn;
        if (!context.usdc.approve(address(context.factory), totalApproval)) revert SmokeApprovalFailed();

        uint256 tokensOut;
        (launch.token, launch.curve, tokensOut) = context.factory.launchTokenAndBuy(
            _launchParams(context, input.creatorTaxBps),
            input.quoteIn,
            input.minTokensOut,
            context.operator
        );
        if (tokensOut < input.minTokensOut) revert InvalidSmokeInput();
    }

    function _launchParams(SmokeContext memory context, uint16 creatorTaxBps)
        private
        view
        returns (IBreadLaunchFactory.LaunchParams memory params)
    {
        params.name = "Bread Day5 Smoke";
        params.symbol = "BD5S";
        params.description = "Day-5 operational smoke";
        params.creatorFeeRecipient = context.operator;
        params.creatorTaxBps = creatorTaxBps;
        params.expectedEconomics = context.factory.previewLaunchEconomics();
    }

    function _completeGraduation(SmokeContext memory context, LaunchResult memory launch)
        private
        returns (IGraduationCoordinator.GraduationRecord memory graduation)
    {
        BreadBondingCurve curve = BreadBondingCurve(launch.curve);
        graduation = context.coordinator.getGraduation(launch.token);
        if (
            graduation.phase == IGraduationCoordinator.GraduationPhase.NOT_GRADUATED
                && curve.readyToGraduate()
        ) {
            context.coordinator.sweep(launch.token);
            graduation = context.coordinator.getGraduation(launch.token);
        }
        if (graduation.phase == IGraduationCoordinator.GraduationPhase.SWEPT) {
            context.coordinator.createPool(launch.token);
            graduation = context.coordinator.getGraduation(launch.token);
        }
        if (graduation.phase != IGraduationCoordinator.GraduationPhase.POOL_CREATED) {
            revert GraduationDidNotComplete();
        }
        if (!context.locker.isPositionLocked(launch.token)) revert PositionNotPermanentlyLocked();
        if (graduation.sweptUsdc != 0 || graduation.sweptTokens != 0 || graduation.poolTokenAmount != 0) {
            revert GraduationResidueNotReconciled();
        }
    }

    function _claimCreatorFees(SmokeContext memory context) private returns (uint256 creatorClaimed) {
        uint256 creatorCredit = context.feeEscrow.balanceOf(context.operator);
        if (creatorCredit == 0) revert CreatorClaimPathMissing();
        uint256 beforeClaim = context.usdc.balanceOf(context.operator);
        creatorClaimed = context.feeEscrow.claim();
        if (
            creatorClaimed != creatorCredit
                || context.usdc.balanceOf(context.operator) != beforeClaim + creatorClaimed
        ) revert CreatorClaimMismatch();
    }

    function _assertReplayRejected(GraduationCoordinator coordinator, address token) private {
        (bool replay,) = address(coordinator).call(
            abi.encodeWithSelector(coordinator.createPool.selector, token)
        );
        if (replay) revert ReplayUnexpectedlySucceeded();
    }
}
