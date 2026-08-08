// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../../src/core/BreadBondingCurve.sol";

interface BreadVm {
    function warp(uint256 newTimestamp) external;
}

library BreadTestTime {
    address private constant HEVM_ADDRESS = address(uint160(uint256(keccak256("hevm cheat code"))));

    function expireOpening(BreadBondingCurve curve) internal {
        BreadVm(HEVM_ADDRESS).warp(uint256(curve.launchTimestamp()) + uint256(curve.SNIPE_DURATION_SECONDS()));
    }
}
