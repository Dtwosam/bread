// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {BreadTrackedCurveState} from "../../src/core/BreadTrackedCurveState.sol";

contract BreadTrackedCurveStateHarness is BreadTrackedCurveState {
    constructor(address pairToken_, uint256 phantomQuote_, uint256 graduationThreshold_)
        BreadTrackedCurveState(pairToken_, phantomQuote_, graduationThreshold_)
    {}

    function initialize(address token_) external {
        _initializeTrackedCurve(token_);
    }

    function setTrackedQuoteBuckets(uint256 trackedQuote_, uint256 fee_, uint256 tax_) external {
        trackedQuote = trackedQuote_;
        quoteFeeBalance = fee_;
        creatorTaxBalance = tax_;
    }

    function setTrackedTokens(uint256 amount) external {
        trackedTokens = amount;
    }

    function setGraduated(bool value) external {
        graduated = value;
    }

    function simulateTrackedTokenOut(address recipient, uint256 amount) external {
        trackedTokens -= amount;
        assert(IERC20(token).transfer(recipient, amount));
    }
}
