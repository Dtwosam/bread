// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title BreadTrackedCurveState
/// @notice Abstract tracked-reserve/accounting core extracted from the frozen Pons V2 bonding-curve state model.
/// @dev This contract deliberately contains no trading, fee distribution, quote transfer, graduation transfer, or DEX logic.
abstract contract BreadTrackedCurveState {
    error ZeroAddress();
    error AlreadyInitialized();
    error InvalidLaunchEconomics();

    address public token;
    address public immutable pairToken;
    uint256 public immutable phantomQuote;
    uint256 public immutable graduationThreshold;

    uint256 public quoteFeeBalance;
    uint256 public creatorTaxBalance;
    uint256 public trackedQuote;
    uint256 public trackedTokens;
    uint256 public reservedTokens;
    bool public graduated;

    constructor(address pairToken_, uint256 phantomQuote_, uint256 graduationThreshold_) {
        if (pairToken_ == address(0)) revert ZeroAddress();
        pairToken = pairToken_;
        phantomQuote = phantomQuote_;
        graduationThreshold = graduationThreshold_;
    }

    function _initializeTrackedCurve(address token_) internal {
        if (token != address(0)) revert AlreadyInitialized();
        if (token_ == address(0)) revert ZeroAddress();
        token = token_;

        uint256 supply = IERC20(token_).totalSupply();
        uint256 reserved = Math.mulDiv(supply, phantomQuote, phantomQuote + graduationThreshold);
        if (reserved == 0 || reserved >= supply) revert InvalidLaunchEconomics();

        reservedTokens = reserved;
        trackedTokens = IERC20(token_).balanceOf(address(this));
    }

    function sellableTokens() public view returns (uint256) {
        uint256 tracked = trackedTokens;
        return tracked > reservedTokens ? tracked - reservedTokens : 0;
    }

    function getReserves() public view returns (uint256 quoteReserve_, uint256 tokenReserve_) {
        quoteReserve_ = phantomQuote + trackedQuote - quoteFeeBalance - creatorTaxBalance;
        tokenReserve_ = trackedTokens;
    }

    function quoteReserve() external view returns (uint256 quoteReserve_) {
        (quoteReserve_,) = getReserves();
    }

    function realQuoteReserve() public view returns (uint256) {
        return trackedQuote - quoteFeeBalance - creatorTaxBalance;
    }

    function tokenReserve() external view returns (uint256 tokenReserve_) {
        (, tokenReserve_) = getReserves();
    }

    function readyToGraduate() public view returns (bool) {
        if (graduated) return false;
        return sellableTokens() == 0;
    }
}
