// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IBreadEmergencyController {
    enum RestrictionMode {
        NORMAL,
        NO_NEW_LAUNCHES,
        BUY_PAUSED,
        TRADING_PAUSED
    }

    function restrictionMode() external view returns (RestrictionMode mode);
    function graduationPaused() external view returns (bool paused);
    function launchesAllowed() external view returns (bool allowed);
    function buysAllowed() external view returns (bool allowed);
    function sellsAllowed() external view returns (bool allowed);
}
