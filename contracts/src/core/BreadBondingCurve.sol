// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {BreadTrackedCurveState} from "./BreadTrackedCurveState.sol";
import {BreadBondingCurveMath} from "../libraries/BreadBondingCurveMath.sol";
import {IBreadFeeEscrow} from "../interfaces/IBreadFeeEscrow.sol";
import {IBreadFeePolicy, BreadFeePolicySnapshot} from "../interfaces/IBreadFeePolicy.sol";

/// @title BreadBondingCurve
/// @notice Canonical-USDC Bread trading layer over the tracked-reserve Day-2 core.
contract BreadBondingCurve is BreadTrackedCurveState, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant BASIS_POINTS = 10_000;

    error UnauthorizedFactory();
    error NotInitialized();
    error CurveClosed();
    error RecipientZeroAddress();
    error ZeroAmount();
    error CreatorTaxAboveSnapshotMaximum(uint16 creatorTaxBps, uint16 maxCreatorTaxBps);
    error UnexpectedReceivedAmount(uint256 expected, uint256 received);
    error SlippageExceeded(uint256 minimum, uint256 actual);
    error FinalBuyRequiresPartialFill(uint256 requestedTokensOut, uint256 sellableTokens);

    address public creatorFeeRecipient;
    address public immutable factory;
    IBreadFeePolicy public immutable feePolicy;
    IBreadFeeEscrow public immutable feeEscrow;

    address public immutable protocolFeeRecipient;
    uint16 public immutable tradeFeeBps;
    uint16 public immutable protocolFeeShareBps;
    uint16 public immutable maxCreatorTaxBps;
    uint16 public immutable creatorTaxBps;

    event CurveBuy(
        address indexed buyer,
        address indexed recipient,
        uint256 quoteIn,
        uint256 tokensOut,
        uint256 fee,
        uint256 tax
    );

    constructor(
        address pairToken_,
        address creatorFeeRecipient_,
        address factory_,
        address feePolicy_,
        address feeEscrow_,
        uint256 phantomQuote_,
        uint16 creatorTaxBps_,
        uint256 graduationThreshold_
    ) BreadTrackedCurveState(pairToken_, phantomQuote_, graduationThreshold_) {
        if (
            creatorFeeRecipient_ == address(0) || factory_ == address(0) || feePolicy_ == address(0)
                || feeEscrow_ == address(0)
        ) revert ZeroAddress();

        BreadFeePolicySnapshot memory snapshot = IBreadFeePolicy(feePolicy_).currentFeePolicy();
        if (creatorTaxBps_ > snapshot.maxCreatorTaxBps) {
            revert CreatorTaxAboveSnapshotMaximum(creatorTaxBps_, snapshot.maxCreatorTaxBps);
        }

        creatorFeeRecipient = creatorFeeRecipient_;
        factory = factory_;
        feePolicy = IBreadFeePolicy(feePolicy_);
        feeEscrow = IBreadFeeEscrow(feeEscrow_);
        protocolFeeRecipient = snapshot.protocolFeeRecipient;
        tradeFeeBps = snapshot.tradeFeeBps;
        protocolFeeShareBps = snapshot.protocolFeeShareBps;
        maxCreatorTaxBps = snapshot.maxCreatorTaxBps;
        creatorTaxBps = creatorTaxBps_;
    }

    function initialize(address token_) external {
        if (msg.sender != factory) revert UnauthorizedFactory();
        _initializeTrackedCurve(token_);
    }

    function buy(uint256 quoteIn, uint256 minTokensOut, address recipient)
        external
        nonReentrant
        returns (uint256 tokensOut)
    {
        if (token == address(0)) revert NotInitialized();
        if (graduated || readyToGraduate()) revert CurveClosed();
        if (recipient == address(0)) revert RecipientZeroAddress();
        if (quoteIn == 0) revert ZeroAmount();

        IERC20 quoteToken = IERC20(pairToken);
        uint256 balanceBefore = quoteToken.balanceOf(address(this));
        quoteToken.safeTransferFrom(msg.sender, address(this), quoteIn);
        uint256 received = quoteToken.balanceOf(address(this)) - balanceBefore;
        if (received != quoteIn) revert UnexpectedReceivedAmount(quoteIn, received);

        (uint256 quoteReserve_, uint256 tokenReserve_) = getReserves();
        uint256 fee = quoteIn * tradeFeeBps / BASIS_POINTS;
        uint256 tax = quoteIn * creatorTaxBps / BASIS_POINTS;
        uint256 netQuote = quoteIn - fee - tax;
        tokensOut = BreadBondingCurveMath.getAmountOut(netQuote, quoteReserve_, tokenReserve_, 0);

        uint256 available = sellableTokens();
        if (tokensOut > available) revert FinalBuyRequiresPartialFill(tokensOut, available);
        if (tokensOut < minTokensOut) revert SlippageExceeded(minTokensOut, tokensOut);

        quoteFeeBalance += fee;
        creatorTaxBalance += tax;
        trackedQuote += quoteIn;
        trackedTokens -= tokensOut;

        IERC20(token).safeTransfer(recipient, tokensOut);
        emit CurveBuy(msg.sender, recipient, quoteIn, tokensOut, fee, tax);
    }
}
