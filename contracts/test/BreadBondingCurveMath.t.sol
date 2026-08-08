// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurveMath} from "../src/libraries/BreadBondingCurveMath.sol";
import {FrozenPonsBondingCurveMathReference} from "./helpers/FrozenPonsBondingCurveMathReference.sol";

contract BreadBondingCurveMathHarness {
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut, uint256 feeBps)
        external
        pure
        returns (uint256)
    {
        return BreadBondingCurveMath.getAmountOut(amountIn, reserveIn, reserveOut, feeBps);
    }

    function quoteAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut, uint256 feeBps)
        external
        pure
        returns (uint256)
    {
        return BreadBondingCurveMath.quoteAmountOut(amountIn, reserveIn, reserveOut, feeBps);
    }

    function getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut, uint256 feeBps)
        external
        pure
        returns (uint256)
    {
        return BreadBondingCurveMath.getAmountIn(amountOut, reserveIn, reserveOut, feeBps);
    }
}

contract BreadBondingCurveMathTest {
    BreadBondingCurveMathHarness private harness;

    constructor() {
        harness = new BreadBondingCurveMathHarness();
    }

    function testGetAmountOutMatchesFrozenReference() public pure {
        uint256 actual = BreadBondingCurveMath.getAmountOut(25 ether, 100 ether, 1_000_000 ether, 100);
        uint256 expected = FrozenPonsBondingCurveMathReference.getAmountOut(
            25 ether, 100 ether, 1_000_000 ether, 100
        );
        assert(actual == expected);
    }

    function testGetAmountInMatchesFrozenReference() public pure {
        uint256 actual = BreadBondingCurveMath.getAmountIn(50_000 ether, 125 ether, 1_000_000 ether, 100);
        uint256 expected = FrozenPonsBondingCurveMathReference.getAmountIn(
            50_000 ether, 125 ether, 1_000_000 ether, 100
        );
        assert(actual == expected);
    }

    function testQuoteAmountOutMatchesFrozenReference() public pure {
        uint256 actual = BreadBondingCurveMath.quoteAmountOut(9 ether, 77 ether, 900_000 ether, 250);
        uint256 expected = FrozenPonsBondingCurveMathReference.quoteAmountOut(
            9 ether, 77 ether, 900_000 ether, 250
        );
        assert(actual == expected);
    }

    function testGetAmountOutRevertsOnZeroInput() public {
        _assertRevertSelector(
            abi.encodeCall(harness.getAmountOut, (0, 1, 1, 0)),
            BreadBondingCurveMath.InsufficientInputAmount.selector
        );
    }

    function testGetAmountOutRevertsOnZeroReserve() public {
        _assertRevertSelector(
            abi.encodeCall(harness.getAmountOut, (1, 0, 1, 0)),
            BreadBondingCurveMath.InsufficientLiquidity.selector
        );
        _assertRevertSelector(
            abi.encodeCall(harness.getAmountOut, (1, 1, 0, 0)),
            BreadBondingCurveMath.InsufficientLiquidity.selector
        );
    }

    function testGetAmountOutRevertsWhenRoundedOutputIsZero() public {
        _assertRevertSelector(
            abi.encodeCall(harness.getAmountOut, (1, 1_000, 1, 0)),
            BreadBondingCurveMath.InsufficientOutputAmount.selector
        );
    }

    function testQuoteAmountOutReturnsZeroForInvalidNonRevertingCases() public pure {
        assert(BreadBondingCurveMath.quoteAmountOut(0, 1, 1, 0) == 0);
        assert(BreadBondingCurveMath.quoteAmountOut(1, 0, 1, 0) == 0);
        assert(BreadBondingCurveMath.quoteAmountOut(1, 1, 0, 0) == 0);
        assert(BreadBondingCurveMath.quoteAmountOut(1, 1, 1, 10_000) == 0);
        assert(BreadBondingCurveMath.quoteAmountOut(1, 1, 1, 65_535) == 0);
    }

    function testGetAmountInRevertsOnInvalidLiquidityAndFullFee() public {
        _assertRevertSelector(
            abi.encodeCall(harness.getAmountIn, (0, 1, 2, 0)),
            BreadBondingCurveMath.InsufficientOutputAmount.selector
        );
        _assertRevertSelector(
            abi.encodeCall(harness.getAmountIn, (1, 0, 2, 0)),
            BreadBondingCurveMath.InsufficientLiquidity.selector
        );
        _assertRevertSelector(
            abi.encodeCall(harness.getAmountIn, (2, 1, 2, 0)),
            BreadBondingCurveMath.InsufficientLiquidity.selector
        );
        _assertRevertSelector(
            abi.encodeCall(harness.getAmountIn, (1, 1, 2, 10_000)),
            BreadBondingCurveMath.InsufficientLiquidity.selector
        );
    }

    function testGetAmountInPreservesFrozenRoundUpRule() public pure {
        uint256 amountOut = 17;
        uint256 reserveIn = 101;
        uint256 reserveOut = 997;
        uint256 feeBps = 321;
        uint256 floorValue = amountOut * reserveIn * 10_000
            / ((reserveOut - amountOut) * (10_000 - feeBps));
        assert(BreadBondingCurveMath.getAmountIn(amountOut, reserveIn, reserveOut, feeBps) == floorValue + 1);
    }

    function testFuzz_GetAmountOutMatchesFrozenReference(
        uint128 amountSeed,
        uint128 reserveInSeed,
        uint128 reserveOutSeed,
        uint16 feeSeed
    ) public pure {
        uint256 reserveIn = uint256(reserveInSeed % type(uint64).max) + 1;
        uint256 reserveOut = uint256(reserveOutSeed % type(uint96).max) + 2;
        uint256 amountIn = reserveIn * 10_000 + uint256(amountSeed % 10_000) + 1;
        uint256 feeBps = uint256(feeSeed) % 10_000;

        uint256 actual = BreadBondingCurveMath.getAmountOut(amountIn, reserveIn, reserveOut, feeBps);
        uint256 expected = FrozenPonsBondingCurveMathReference.getAmountOut(
            amountIn, reserveIn, reserveOut, feeBps
        );
        assert(actual == expected);
    }

    function testFuzz_GetAmountInMatchesFrozenReference(
        uint128 outputSeed,
        uint128 reserveInSeed,
        uint128 reserveOutSeed,
        uint16 feeSeed
    ) public pure {
        uint256 reserveIn = uint256(reserveInSeed % type(uint96).max) + 1;
        uint256 reserveOut = uint256(reserveOutSeed % type(uint96).max) + 2;
        uint256 amountOut = uint256(outputSeed) % (reserveOut - 1) + 1;
        uint256 feeBps = uint256(feeSeed) % 10_000;

        uint256 actual = BreadBondingCurveMath.getAmountIn(amountOut, reserveIn, reserveOut, feeBps);
        uint256 expected = FrozenPonsBondingCurveMathReference.getAmountIn(
            amountOut, reserveIn, reserveOut, feeBps
        );
        assert(actual == expected);
    }

    function testFuzz_OutputAlwaysBelowReserveOut(
        uint128 amountSeed,
        uint128 reserveInSeed,
        uint128 reserveOutSeed,
        uint16 feeSeed
    ) public pure {
        uint256 amountIn = uint256(amountSeed % type(uint96).max) + 1;
        uint256 reserveIn = uint256(reserveInSeed % type(uint96).max) + 1;
        uint256 reserveOut = uint256(reserveOutSeed % type(uint96).max) + 1;
        uint256 feeBps = uint256(feeSeed) % 10_000;

        uint256 output = BreadBondingCurveMath.quoteAmountOut(amountIn, reserveIn, reserveOut, feeBps);
        assert(output < reserveOut);
    }

    function testFuzz_LargerInputNeverProducesSmallerOutput(
        uint128 aSeed,
        uint128 deltaSeed,
        uint128 reserveInSeed,
        uint128 reserveOutSeed,
        uint16 feeSeed
    ) public pure {
        uint256 amountA = uint256(aSeed % type(uint80).max) + 1;
        uint256 amountB = amountA + uint256(deltaSeed % type(uint80).max);
        uint256 reserveIn = uint256(reserveInSeed % type(uint96).max) + 1;
        uint256 reserveOut = uint256(reserveOutSeed % type(uint96).max) + 1;
        uint256 feeBps = uint256(feeSeed) % 10_000;

        uint256 outputA = BreadBondingCurveMath.quoteAmountOut(amountA, reserveIn, reserveOut, feeBps);
        uint256 outputB = BreadBondingCurveMath.quoteAmountOut(amountB, reserveIn, reserveOut, feeBps);
        assert(outputB >= outputA);
    }

    function testFuzz_LargerFeeNeverProducesLargerOutput(
        uint128 amountSeed,
        uint128 reserveInSeed,
        uint128 reserveOutSeed,
        uint16 feeASeed,
        uint16 feeDeltaSeed
    ) public pure {
        uint256 amountIn = uint256(amountSeed % type(uint96).max) + 1;
        uint256 reserveIn = uint256(reserveInSeed % type(uint96).max) + 1;
        uint256 reserveOut = uint256(reserveOutSeed % type(uint96).max) + 1;
        uint256 feeA = uint256(feeASeed) % 10_000;
        uint256 feeB = feeA + uint256(feeDeltaSeed) % (10_000 - feeA);

        uint256 outputA = BreadBondingCurveMath.quoteAmountOut(amountIn, reserveIn, reserveOut, feeA);
        uint256 outputB = BreadBondingCurveMath.quoteAmountOut(amountIn, reserveIn, reserveOut, feeB);
        assert(outputB <= outputA);
    }

    function _assertRevertSelector(bytes memory callData, bytes4 expectedSelector) private {
        (bool ok, bytes memory data) = address(harness).call(callData);
        assert(!ok);
        assert(data.length >= 4);
        bytes4 actualSelector;
        assembly ("memory-safe") {
            actualSelector := mload(add(data, 0x20))
        }
        assert(actualSelector == expectedSelector);
    }
}
