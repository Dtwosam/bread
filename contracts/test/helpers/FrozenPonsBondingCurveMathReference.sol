// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @dev Independent test-only encoding of the frozen Pons V2 math at
/// d5491e20be56051a68abf47136f6890c3ce3ff7d. This file must not import Bread production code.
library FrozenPonsBondingCurveMathReference {
    uint256 internal constant BASIS_POINTS = 10_000;

    error InsufficientInputAmount();
    error InsufficientOutputAmount();
    error InsufficientLiquidity();

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut, uint256 feeBps)
        internal
        pure
        returns (uint256 amountOut)
    {
        if (amountIn == 0) revert InsufficientInputAmount();
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();

        amountOut = _amountOut(amountIn, reserveIn, reserveOut, feeBps);
        if (amountOut == 0) revert InsufficientOutputAmount();
    }

    function quoteAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut, uint256 feeBps)
        internal
        pure
        returns (uint256 amountOut)
    {
        if (amountIn == 0 || reserveIn == 0 || reserveOut == 0 || feeBps >= BASIS_POINTS) return 0;
        return _amountOut(amountIn, reserveIn, reserveOut, feeBps);
    }

    function _amountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut, uint256 feeBps)
        private
        pure
        returns (uint256)
    {
        uint256 amountInWithFee = amountIn * (BASIS_POINTS - feeBps);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * BASIS_POINTS + amountInWithFee;
        return numerator / denominator;
    }

    function getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut, uint256 feeBps)
        internal
        pure
        returns (uint256 amountIn)
    {
        if (amountOut == 0) revert InsufficientOutputAmount();
        if (reserveIn == 0 || reserveOut <= amountOut) revert InsufficientLiquidity();
        if (feeBps >= BASIS_POINTS) revert InsufficientLiquidity();

        uint256 numerator = amountOut * reserveIn * BASIS_POINTS;
        uint256 denominator = (reserveOut - amountOut) * (BASIS_POINTS - feeBps);
        amountIn = numerator / denominator + 1;
    }
}
