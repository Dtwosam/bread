// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IBreadLaunchFactory} from "../../src/interfaces/IBreadLaunchFactory.sol";

contract BreadLaunchAbiHarness {
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
