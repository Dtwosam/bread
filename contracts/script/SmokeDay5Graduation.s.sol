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
    error GraduationDidNotComplete();
    error PositionNotPermanentlyLocked();
    error GraduationResidueNotReconciled();
    error CreatorClaimPathMissing();
    error CreatorClaimMismatch();
    error ReplayUnexpectedlySucceeded();

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
        address expectedOperator = VM.envAddress("BREAD_SMOKE_OPERATOR");
        if (operator != expectedOperator) revert InvalidPrivateKeyOwner();

        IBreadLaunchFactory factory = IBreadLaunchFactory(VM.envAddress("BREAD_FACTORY"));
        GraduationCoordinator coordinator = GraduationCoordinator(VM.envAddress("BREAD_GRADUATION_COORDINATOR"));
        BreadPermanentLiquidityLocker locker =
            BreadPermanentLiquidityLocker(VM.envAddress("BREAD_PERMANENT_LIQUIDITY_LOCKER"));
        IERC20 usdc = IERC20(VM.envAddress("BREAD_USDC"));
        BreadFeeEscrow feeEscrow = BreadFeeEscrow(coordinator.feeEscrow());
        uint256 quoteIn = VM.envUint("BREAD_SMOKE_QUOTE_IN");
        uint256 minTokensOut = VM.envUint("BREAD_SMOKE_MIN_TOKENS_OUT");
        uint256 creatorTaxRaw = VM.envUint("BREAD_SMOKE_CREATOR_TAX_BPS");
        if (quoteIn == 0 || minTokensOut == 0 || creatorTaxRaw == 0 || creatorTaxRaw > type(uint16).max) {
            revert InvalidSmokeInput();
        }

        (IBreadLaunchFactory.LaunchConfig memory config,) = factory.currentLaunchConfig();
        uint256 totalApproval = config.launchFeeUsdc + quoteIn;
        if (usdc.balanceOf(operator) < totalApproval) revert InvalidSmokeInput();

        VM.startBroadcast(privateKey);
        require(usdc.approve(address(factory), totalApproval), "SMOKE_APPROVE_FAILED");
        (address token, address curveAddress, uint256 tokensOut) = factory.launchTokenAndBuy(
            IBreadLaunchFactory.LaunchParams({
                name: "Bread Day5 Smoke",
                symbol: "BD5S",
                logo: "",
                description: "Day-5 operational smoke",
                twitter: "",
                telegram: "",
                discord: "",
                website: "",
                farcaster: "",
                creatorFeeRecipient: operator,
                creatorTaxBps: uint16(creatorTaxRaw),
                expectedEconomics: factory.previewLaunchEconomics()
            }),
            quoteIn,
            minTokensOut,
            operator
        );
        if (tokensOut < minTokensOut) revert InvalidSmokeInput();

        BreadBondingCurve curve = BreadBondingCurve(curveAddress);
        IGraduationCoordinator.GraduationRecord memory graduation = coordinator.getGraduation(token);
        if (graduation.phase == IGraduationCoordinator.GraduationPhase.NOT_GRADUATED && curve.readyToGraduate()) {
            coordinator.sweep(token);
            graduation = coordinator.getGraduation(token);
        }
        if (graduation.phase == IGraduationCoordinator.GraduationPhase.SWEPT) {
            coordinator.createPool(token);
            graduation = coordinator.getGraduation(token);
        }
        if (graduation.phase != IGraduationCoordinator.GraduationPhase.POOL_CREATED) {
            revert GraduationDidNotComplete();
        }
        if (!locker.isPositionLocked(token)) revert PositionNotPermanentlyLocked();
        if (graduation.sweptUsdc != 0 || graduation.sweptTokens != 0 || graduation.poolTokenAmount != 0) {
            revert GraduationResidueNotReconciled();
        }

        uint256 creatorCredit = feeEscrow.balanceOf(operator);
        if (creatorCredit == 0) revert CreatorClaimPathMissing();
        uint256 beforeClaim = usdc.balanceOf(operator);
        uint256 creatorClaimed = feeEscrow.claim();
        if (creatorClaimed != creatorCredit || usdc.balanceOf(operator) != beforeClaim + creatorClaimed) {
            revert CreatorClaimMismatch();
        }

        (bool replay,) = address(coordinator).call(
            abi.encodeWithSelector(coordinator.createPool.selector, token)
        );
        if (replay) revert ReplayUnexpectedlySucceeded();
        VM.stopBroadcast();

        emit Day5SmokePass(token, curveAddress, graduation.poolId, graduation.positionId, creatorClaimed);
    }
}
