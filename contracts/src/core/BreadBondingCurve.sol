// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {BreadTrackedCurveState} from "./BreadTrackedCurveState.sol";
import {BreadBondingCurveMath} from "../libraries/BreadBondingCurveMath.sol";
import {IBreadEmergencyController} from "../interfaces/IBreadEmergencyController.sol";
import {IBreadFeeEscrow} from "../interfaces/IBreadFeeEscrow.sol";
import {IBreadFeePolicy, BreadFeePolicySnapshot} from "../interfaces/IBreadFeePolicy.sol";
import {IGraduationCoordinator} from "../interfaces/IGraduationCoordinator.sol";

/// @title BreadBondingCurve
/// @notice Canonical-USDC Bread trading layer over the tracked-reserve Day-2 core.
contract BreadBondingCurve is BreadTrackedCurveState, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant BASIS_POINTS = 10_000;
    bytes4 private constant GRADUATION_COORDINATOR_SELECTOR = bytes4(keccak256("graduationCoordinator()"));
    uint16 public constant STARTING_SNIPE_TAX_BPS = 9_900;
    uint8 public constant SNIPE_DURATION_SECONDS = 5;
    uint16 public constant TERMINAL_SNIPE_TAX_BPS = 0;

    error UnauthorizedFactory();
    error UnauthorizedFeeSweep();
    error UnauthorizedGraduationCoordinator();
    error NotInitialized();
    error CurveClosed();
    error NotReadyToGraduate();
    error RecipientZeroAddress();
    error ZeroAmount();
    error NoFeesToSweep();
    error CreatorTaxAboveSnapshotMaximum(uint16 creatorTaxBps, uint16 maxCreatorTaxBps);
    error UnexpectedReceivedAmount(uint256 expected, uint256 received);
    error SlippageExceeded(uint256 minimum, uint256 actual);
    error LaunchBuyExemptionAlreadyConsumed();
    error LaunchBuyExemptionExpired();
    error BuysRestricted();
    error SellsRestricted();
    error InsufficientFinalFillInput(uint256 required, uint256 actual);

    struct BuyCharges {
        uint256 fee;
        uint256 creatorTax;
        uint256 snipeTax;
        uint256 netCurveInput;
    }

    struct BuyQuote {
        uint256 tokensOut;
        uint256 spent;
        BuyCharges charges;
    }

    address public creatorFeeRecipient;
    address public immutable factory;
    IBreadFeePolicy public immutable feePolicy;
    IBreadFeeEscrow public immutable feeEscrow;
    IBreadEmergencyController public immutable emergencyController;

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
    event GraduationReady(address indexed token, address indexed curve, address indexed coordinator);
    event GraduationAutoAttemptFailed(address indexed token, bytes32 reasonHash);
    event CurveGraduationReleased(
        address indexed coordinator,
        uint256 seedUsdc,
        uint256 tokenOut,
        uint256 protocolFeeAmount,
        uint256 creatorFeeAmount
    );

    constructor(
        address pairToken_,
        address creatorFeeRecipient_,
        address factory_,
        address feePolicy_,
        address feeEscrow_,
        address emergencyController_,
        uint256 phantomQuote_,
        uint16 creatorTaxBps_,
        uint256 graduationThreshold_
    ) BreadTrackedCurveState(pairToken_, phantomQuote_, graduationThreshold_) {
        if (
            creatorFeeRecipient_ == address(0) || factory_ == address(0) || feePolicy_ == address(0)
                || feeEscrow_ == address(0) || emergencyController_ == address(0)
        ) revert ZeroAddress();

        BreadFeePolicySnapshot memory snapshot = IBreadFeePolicy(feePolicy_).currentFeePolicy();
        if (creatorTaxBps_ > snapshot.maxCreatorTaxBps) {
            revert CreatorTaxAboveSnapshotMaximum(creatorTaxBps_, snapshot.maxCreatorTaxBps);
        }

        creatorFeeRecipient = creatorFeeRecipient_;
        factory = factory_;
        feePolicy = IBreadFeePolicy(feePolicy_);
        feeEscrow = IBreadFeeEscrow(feeEscrow_);
        emergencyController = IBreadEmergencyController(emergencyController_);
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

    /// @notice Resolves the Factory's one-time-bound canonical graduation coordinator.
    /// @dev Returns zero for isolated legacy/unit-test factory harnesses that do not expose the Day-5 getter.
    function graduationCoordinator() public view returns (address coordinator) {
        (bool ok, bytes memory data) = factory.staticcall(abi.encodeWithSelector(GRADUATION_COORDINATOR_SELECTOR));
        if (!ok || data.length != 32) return address(0);
        coordinator = abi.decode(data, (address));
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
        if (!emergencyController.buysAllowed()) revert BuysRestricted();
        (tokensOut,,) = _buy(quoteIn, minTokensOut, recipient, currentSnipeTaxBps(), false);
    }

    /// @notice Factory-only initial-buy entry used by the atomic Launch+Buy lifecycle.
    function buyForLaunch(uint256 quoteIn, uint256 minTokensOut, address recipient)
        external
        nonReentrant
        returns (uint256 tokensOut, uint256 spent, uint256 refund)
    {
        if (msg.sender != factory) revert UnauthorizedFactory();
        if (!emergencyController.buysAllowed()) revert BuysRestricted();
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

        BuyQuote memory quoted = _quoteBuy(received, snipeTaxBps);
        if (quoted.spent * minTokensOut > received * quoted.tokensOut) {
            revert SlippageExceeded(minTokensOut, quoted.tokensOut);
        }

        quoteFeeBalance += quoted.charges.fee + quoted.charges.snipeTax;
        creatorTaxBalance += quoted.charges.creatorTax;
        trackedQuote += quoted.spent;
        trackedTokens -= quoted.tokensOut;

        IERC20(token).safeTransfer(recipient, quoted.tokensOut);

        refund = received - quoted.spent;
        if (refund != 0) {
            emit CurveBuyRefunded(msg.sender, refund);
            quoteToken.safeTransfer(msg.sender, refund);
        }

        emit OpeningProtectionApplied(
            msg.sender,
            recipient,
            snipeTaxBps,
            quoted.charges.snipeTax,
            launchBuyExempt
        );
        emit CurveBuy(
            msg.sender,
            recipient,
            quoted.spent,
            quoted.tokensOut,
            quoted.charges.fee,
            quoted.charges.creatorTax
        );

        _tryAutoGraduation();
        return (quoted.tokensOut, quoted.spent, refund);
    }

    function _quoteBuy(uint256 received, uint16 snipeTaxBps) private view returns (BuyQuote memory quoted) {
        (uint256 quoteReserve_, uint256 tokenReserve_) = getReserves();
        quoted.spent = received;
        quoted.charges = _buyCharges(received, snipeTaxBps);
        quoted.tokensOut = BreadBondingCurveMath.getAmountOut(
            quoted.charges.netCurveInput,
            quoteReserve_,
            tokenReserve_,
            0
        );

        uint256 available = tokenReserve_ > reservedTokens ? tokenReserve_ - reservedTokens : 0;
        if (available == 0) revert CurveClosed();

        if (quoted.tokensOut > available) {
            quoted.tokensOut = available;
            uint256 netRequired = BreadBondingCurveMath.getAmountIn(available, quoteReserve_, tokenReserve_, 0);
            uint256 afterStandardRequired = Math.mulDiv(
                netRequired,
                BASIS_POINTS,
                BASIS_POINTS - uint256(snipeTaxBps),
                Math.Rounding.Ceil
            );
            uint256 grossRequired = Math.mulDiv(
                afterStandardRequired,
                BASIS_POINTS,
                BASIS_POINTS - uint256(tradeFeeBps) - uint256(creatorTaxBps),
                Math.Rounding.Ceil
            );
            quoted.spent = Math.min(grossRequired, received);
            quoted.charges = _buyCharges(quoted.spent, snipeTaxBps);
            if (quoted.charges.netCurveInput < netRequired) {
                revert InsufficientFinalFillInput(netRequired, quoted.charges.netCurveInput);
            }
        }
    }

    function _buyCharges(uint256 spent, uint16 snipeTaxBps) private view returns (BuyCharges memory charges) {
        charges.fee = spent * tradeFeeBps / BASIS_POINTS;
        charges.creatorTax = spent * creatorTaxBps / BASIS_POINTS;
        uint256 afterStandard = spent - charges.fee - charges.creatorTax;
        charges.snipeTax = afterStandard * snipeTaxBps / BASIS_POINTS;
        charges.netCurveInput = afterStandard - charges.snipeTax;
    }

    function sell(uint256 tokensIn, uint256 minQuoteOut, address recipient)
        external
        nonReentrant
        returns (uint256 quoteOut)
    {
        if (!emergencyController.sellsAllowed()) revert SellsRestricted();
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

        (
            ,
            uint256 pendingTax,
            uint256 totalPending,
            uint256 protocolAmount,
            uint256 creatorAmount
        ) = _pendingFeeAmounts();
        if (totalPending == 0) revert NoFeesToSweep();

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

    /// @notice Closes a ready curve and releases only tracked graduation value to its canonical coordinator.
    /// @dev Deliberately not nonReentrant: the coordinator may call this from the best-effort callback inside buy().
    function releaseForGraduation()
        external
        returns (uint256 seedUsdc, uint256 tokenOut, uint256 protocolFeeAmount, uint256 creatorFeeAmount)
    {
        address coordinator = graduationCoordinator();
        if (coordinator == address(0) || msg.sender != coordinator) revert UnauthorizedGraduationCoordinator();
        if (!readyToGraduate()) revert NotReadyToGraduate();

        graduated = true;

        (
            uint256 pendingBaseFee,
            uint256 pendingTax,
            uint256 totalPending,
            uint256 protocolAmount,
            uint256 creatorAmount
        ) = _pendingFeeAmounts();
        protocolFeeAmount = protocolAmount;
        creatorFeeAmount = creatorAmount;

        quoteFeeBalance = 0;
        creatorTaxBalance = 0;
        trackedQuote -= totalPending;

        seedUsdc = trackedQuote;
        tokenOut = trackedTokens;
        trackedQuote = 0;
        trackedTokens = 0;

        uint256 totalUsdcOut = seedUsdc + protocolFeeAmount + creatorFeeAmount;
        if (totalUsdcOut != 0) IERC20(pairToken).safeTransfer(msg.sender, totalUsdcOut);
        if (tokenOut != 0) IERC20(token).safeTransfer(msg.sender, tokenOut);

        if (pendingBaseFee != 0 || pendingTax != 0) {
            emit FeesSwept(protocolFeeAmount, creatorFeeAmount, pendingTax);
        }
        emit CurveGraduationReleased(msg.sender, seedUsdc, tokenOut, protocolFeeAmount, creatorFeeAmount);
    }

    function _tryAutoGraduation() private {
        if (!readyToGraduate()) return;
        address coordinator = graduationCoordinator();
        if (coordinator == address(0)) return;

        emit GraduationReady(token, address(this), coordinator);
        try IGraduationCoordinator(coordinator).sweep(token) {
            // Committed Stage-1 state is emitted by the coordinator.
        } catch (bytes memory reason) {
            emit GraduationAutoAttemptFailed(token, keccak256(reason));
        }
    }

    function _pendingFeeAmounts()
        private
        view
        returns (
            uint256 pendingBaseFee,
            uint256 pendingTax,
            uint256 totalPending,
            uint256 protocolAmount,
            uint256 creatorAmount
        )
    {
        pendingBaseFee = quoteFeeBalance;
        pendingTax = creatorTaxBalance;
        totalPending = pendingBaseFee + pendingTax;
        protocolAmount = pendingBaseFee * protocolFeeShareBps / BASIS_POINTS;
        creatorAmount = pendingBaseFee - protocolAmount + pendingTax;
    }
}
