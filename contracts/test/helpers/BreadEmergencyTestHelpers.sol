// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IBreadEmergencyController} from "../../src/interfaces/IBreadEmergencyController.sol";

/// @notice Test-only unrestricted oracle for legacy unit fixtures whose subject is not emergency behavior.
contract BreadAlwaysOpenEmergencyController is IBreadEmergencyController {
    function restrictionMode() external pure returns (RestrictionMode mode) {
        return RestrictionMode.NORMAL;
    }

    function graduationPaused() external pure returns (bool paused) {
        return false;
    }

    function launchesAllowed() external pure returns (bool allowed) {
        return true;
    }

    function buysAllowed() external pure returns (bool allowed) {
        return true;
    }

    function sellsAllowed() external pure returns (bool allowed) {
        return true;
    }
}
