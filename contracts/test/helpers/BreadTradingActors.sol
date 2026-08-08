// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../../src/core/BreadBondingCurve.sol";
import {BreadFeeEscrow} from "../../src/fees/BreadFeeEscrow.sol";

contract BreadTradingExternalCaller {
    function sweepFees(BreadBondingCurve curve) external {
        curve.sweepFees();
    }

    function setCreatorFeeRecipient(BreadBondingCurve curve, address nextRecipient) external {
        curve.setCreatorFeeRecipient(nextRecipient);
    }
}

contract BreadFeeClaimRecipient {
    function claim(BreadFeeEscrow escrow) external returns (uint256 amount) {
        return escrow.claim();
    }

    function claim(BreadFeeEscrow escrow, uint256 amount) external returns (uint256 claimed) {
        return escrow.claim(amount);
    }
}
