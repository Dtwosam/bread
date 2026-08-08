// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IBreadEmergencyController} from "../../src/interfaces/IBreadEmergencyController.sol";
import {IBreadLaunchFactory} from "../../src/interfaces/IBreadLaunchFactory.sol";

contract BreadAlwaysOpenEmergencyController is IBreadEmergencyController {
    function restrictionMode() external pure returns (RestrictionMode) {
        return RestrictionMode.NORMAL;
    }

    function graduationPaused() external pure returns (bool) {
        return false;
    }

    function launchesAllowed() external pure returns (bool) {
        return true;
    }

    function buysAllowed() external pure returns (bool) {
        return true;
    }

    function sellsAllowed() external pure returns (bool) {
        return true;
    }
}

contract BreadDay4ExternalCaller {
    function launchToken(IBreadLaunchFactory factory, IBreadLaunchFactory.LaunchParams calldata params)
        external
        returns (address token, address curve)
    {
        return factory.launchToken(params);
    }

    function launchTokenAndBuy(
        IBreadLaunchFactory factory,
        IBreadLaunchFactory.LaunchParams calldata params,
        uint256 quoteIn,
        uint256 minTokensOut,
        address recipient
    ) external returns (address token, address curve, uint256 tokensOut) {
        return factory.launchTokenAndBuy(params, quoteIn, minTokensOut, recipient);
    }
}
