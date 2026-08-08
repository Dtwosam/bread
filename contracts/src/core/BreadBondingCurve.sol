// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {BreadTrackedCurveState} from "./BreadTrackedCurveState.sol";
import {BreadBondingCurveMath} from "../libraries/BreadBondingCurveMath.sol";
import {IBreadFeeEscrow} from "../interfaces/IBreadFeeEscrow.sol";
import {IBreadFeePolicy, BreadFeePolicySnapshot} from "../interfaces/IBreadFeePolicy.sol";

/// @title BreadBondingCurve
/// @notice Canonical-USDC Bread trading layer over the tracked-reserve Day-2 core.
contract BreadBondingCurve is BreadTrackedCurveState, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant BASIS_POINTS = 10_000;
    uint16 public constant STARTING_SNIPE_TAX_BPS = 9_900;
    uint8 public constant SNIPE_DURATION_SECONDS = 5;
    uint16 public constant TERMINAL_SNIPE_TAX_BPS = 0;

    error UnauthorizedFactory();
    error UnauthorizedFeeSweep();
    error NotInitialized();
    error CurveClosed();
    error RecipientZeroAddress();
    error ZeroAmount();
    error NoFeesToSweep();
    error CreatorTaxAboveSnapshotMaximum(uint16 creatorTaxBps, uint16 maxCreatorTaxBps);
    error UnexpectedReceivedAmount(uint256 expected, uint256 received);
    error SlippageExceeded(uint256 minimum, uint256 actual);
    error LaunchBuyExemptionAlreadyConsumed();
    error LaunchBuyExemptionExpired();

    address public creatorFeeRecipient;
    address public immutable factory;
    IBreadFeePolicy public immutable feePolicy;
    IBreadFeeEscrow public immutable feeEscrow;

    address public immutable protocolFeeRecipient;
    uint16 public immutable tradeFeeBps;
    uint16 public immutable protocolFeeShareBps;
    uint16 public immutable maxCreatorTaxBps;
    uint16 public immutable creatorTaxBps;

    uint64 public launchTimestamp;
    bool public launchBuyExemptionConsumed;

    event CreatorFeeRecipientUpdated(address indexed previousRecipient, address indexed nextRecipient);
    event CurveBuy(
        address indexed buyer,
        address indexed recipient,
        uint256 quoteIn,
        uint256 tokensOut,
        uint256 fee,
        uint256 tax
    );
    event CurveBuyRefunded(address indexed buyer, uint256 refund);
    event OpeningProtectionApplied(
        address indexed buyer,
        address indexed recipient,
        uint16 taxBps,
        uint256 taxAmount,
        bool launchBuyExempt
    );
    event CurveSell(
        address indexed seller,
        address indexed recipient,
        uint256 tokensIn,
        uint256 quoteOut,
        uint256 fee,
        uint256 tax
    );
    event FeesSwept(uint256 protocolAmount, uint256 creatorAmount, uint256 creatorTaxAmount);

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
        launchTimestamp = uint64(block.timestamp);
    }

    function currentSnipeTaxBps() public view returns (uint16) {
        if (token == address(0) || launchTimestamp == 0) revert NotInitialized();
        uint256 elapsed = block.timestamp - uint256(launchTimestamp);
        if (elapsed >= SNIPE_DURATION_SECONDS) return TERMINAL_SNIPE_TAX_BPS;
        uint256 remaining = SNIPE_DURATION_SECONDS - elapsed;
        return uint16(uint256(STARTING_SNIPE_TAX_BPS) * remaining * remaining / 25);
    }

    function setCreatorFeeRecipient(address nextRecipient) external {
        if (msg.sender != factory) revert UnauthorizedFactory();
        if (nextRecipient == address(0)) revert RecipientZeroAddress();

        address previousRecipient = creatorFeeRecipient;
        creatorFeeRecipient = nextRecipient;
        emit CreatorFeeRecipientUpdated(previousRecipient, nextRecipient);
    }

    function buy(uint256 quoteIn, uint256 minTokensOut, address recipient)
        external
        nonReentrant
        returns (uint256 tokensOut)
    {
        (tokensOut,,) = _buy(quoteIn, minTokensOut, recipient, currentSnipeTaxBps(), false);
    }

    /// @notice Factory-only initial-buy entry used by the atomic Launch+Buy lifecycle.
    function buyForLaunch(uint256 quoteIn, uint256 minTokensOut, address recipient)
        external
        nonReentrant
        returns (uint256 tokensOut, uint256 spent, uint256 refund)
    {
        if (msg.sender != factory) revert UnauthorizedFactory();
        if (token == address(0) || launchTimestamp == 0) revert NotInitialized();
        if (block.timestamp != uint256(launchTimestamp)) revert LaunchBuyExemptionExpired();
        if (launchBuyExemptionConsumed) revert LaunchBuyExemptionAlreadyConsumed();
        launchBuyExemptionConsumed = true;
        return _buy(quoteIn, minTokensOut, recipient, 0, true);
    }

    function _buy(
        uint256 quoteIn,
        uint256 minTokensOut,
        address recipient,
        uint16 snipeTaxBps,
        bool launchBuyExempt
    ) private returns (uint256 tokensOut, uint256 spent, uint256 refund) {
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
        spent = received;
        uint256 fee = spent * tradeFeeBps / BASIS_POINTS;
        uint256 tax = spent * creatorTaxBps / BASIS_POINTS;
        uint256 afterStandard = spent - fee - tax;
        uint256 snipeTax = afterStandard * snipeTaxBps / BASIS_POINTS;
        uint256 netCurveInput = afterStandard - snipeTax;
        tokensOut = BreadBondingCurveMath.getAmountOut(netCurveInput, quoteReserve_, tokenReserve_, 0);

        uint256 available = tokenReserve_ > reservedTokens ? tokenReserve_ - reservedTokens : 0;
        if (available == 0) revert CurveClosed();

        if (tokensOut > available) {
            tokensOut = available;
            uint256 net = BreadBondingCurveMath.getAmountIn(available, quoteReserve_, tokenReserve_, 0);
            spent = Math.min(
                Math.mulDiv(
                    net,
                    BASIS_POINTS,
                    BASIS_POINTS - uint256(tradeFeeBps) - uint256(creatorTaxBps),
                    Math.Rounding.Ceil
                ),
                received
            );
            fee = spent * tradeFeeBps / BASIS_POINTS;
            tax = spent * creatorTaxBps / BASIS_POINTS;
            afterStandard = spent - fee - tax;
            snipeTax = afterStandard * snipeTaxBps / BASIS_POINTS;
            netCurveInput = afterStandard - snipeTax;
        }

        if (spent * minTokensOut > received * tokensOut) revert SlippageExceeded(minTokensOut, tokensOut);

        quoteFeeBalance += fee + snipeTax;
        creatorTaxBalance += tax;
        trackedQuote += spent;
        trackedTokens -= tokensOut;

        IERC20(token).safeTransfer(recipient, tokensOut);

        refund = received - spent;
        if (refund != 0) {
            emit CurveBuyRefunded(msg.sender, refund);
            quoteToken.safeTransfer(msg.sender, refund);
        }

        emit OpeningProtectionApplied(msg.sender, recipient, snipeTaxBps, snipeTax, launchBuyExempt);
        emit CurveBuy(msg.sender, recipient, spent, tokensOut, fee, tax);
    }

    function sell(uint256 tokensIn, uint256 minQuoteOut, address recipient)
        external
        nonReentrant
        returns (uint256 quoteOut)
    {
        if (token == address(0)) revert NotInitialized();
        if (graduated || readyToGraduate()) revert CurveClosed();
        if (recipient == address(0)) revert RecipientZeroAddress();
        if (tokensIn == 0) revert ZeroAmount();

        (uint256 quoteReserve_, uint256 tokenReserve_) = getReserves();

        IERC20 launchToken = IERC20(token);
        uint256 balanceBefore = launchToken.balanceOf(address(this));
        launchToken.safeTransferFrom(msg.sender, address(this), tokensIn);
        uint256 received = launchToken.balanceOf(address(this)) - balanceBefore;
        if (received != tokensIn) revert UnexpectedReceivedAmount(tokensIn, received);

        uint256 grossQuoteOut = BreadBondingCurveMath.getAmountOut(tokensIn, tokenReserve_, quoteReserve_, 0);
        uint256 fee = grossQuoteOut * tradeFeeBps / BASIS_POINTS;
        uint256 tax = grossQuoteOut * creatorTaxBps / BASIS_POINTS;
        quoteOut = grossQuoteOut - fee - tax;
        if (quoteOut < minQuoteOut) revert SlippageExceeded(minQuoteOut, quoteOut);

        quoteFeeBalance += fee;
        creatorTaxBalance += tax;
        trackedQuote -= quoteOut;
        trackedTokens += tokensIn;

        IERC20(pairToken).safeTransfer(recipient, quoteOut);
        emit CurveSell(msg.sender, recipient, tokensIn, quoteOut, fee, tax);
    }

    function sweepFees() external nonReentrant {
        if (msg.sender != creatorFeeRecipient && msg.sender != feePolicy.feeSweepOperator()) {
            revert UnauthorizedFeeSweep();
        }

        uint256 pendingBaseFee = quoteFeeBalance;
        uint256 pendingTax = creatorTaxBalance;
        uint256 totalPending = pendingBaseFee + pendingTax;
        if (totalPending == 0) revert NoFeesToSweep();

        uint256 protocolAmount = pendingBaseFee * protocolFeeShareBps / BASIS_POINTS;
        uint256 creatorAmount = pendingBaseFee - protocolAmount + pendingTax;

        quoteFeeBalance = 0;
        creatorTaxBalance = 0;
        trackedQuote -= totalPending;

        IERC20 quoteToken = IERC20(pairToken);
        if (protocolAmount != 0) {
            quoteToken.forceApprove(address(feeEscrow), protocolAmount);
            feeEscrow.credit(protocolFeeRecipient, protocolAmount);
        }
        if (creatorAmount != 0) {
            quoteToken.forceApprove(address(feeEscrow), creatorAmount);
            feeEscrow.credit(creatorFeeRecipient, creatorAmount);
        }

        emit FeesSwept(protocolAmount, creatorAmount, pendingTax);
    }
}
