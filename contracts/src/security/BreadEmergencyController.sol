// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IBreadEmergencyController} from "../interfaces/IBreadEmergencyController.sol";

/// @title BreadEmergencyController
/// @notice Restriction-only emergency authority. It owns no funds and cannot alter launch economics.
contract BreadEmergencyController is Ownable, IBreadEmergencyController {
    error ZeroAddress();
    error UnauthorizedEmergencyActor();
    error GuardianCannotReduceRestriction();
    error GuardianCannotClearGraduationPause();
    error OwnershipRenounceDisabled();

    address public guardian;
    RestrictionMode public override restrictionMode;
    bool public override graduationPaused;

    event GuardianUpdated(address indexed previousGuardian, address indexed nextGuardian);
    event RestrictionModeUpdated(
        address indexed actor,
        RestrictionMode previousMode,
        RestrictionMode nextMode
    );
    event GraduationPauseUpdated(address indexed actor, bool previousPaused, bool nextPaused);

    constructor(address protocolAdmin_, address guardian_) Ownable(protocolAdmin_) {
        if (protocolAdmin_ == address(0) || guardian_ == address(0)) revert ZeroAddress();
        guardian = guardian_;
    }

    function setRestrictionMode(RestrictionMode next) external {
        RestrictionMode previous = restrictionMode;
        if (msg.sender == owner()) {
            restrictionMode = next;
        } else if (msg.sender == guardian) {
            if (uint8(next) < uint8(previous)) revert GuardianCannotReduceRestriction();
            restrictionMode = next;
        } else {
            revert UnauthorizedEmergencyActor();
        }

        emit RestrictionModeUpdated(msg.sender, previous, next);
    }

    function setGraduationPaused(bool paused) external {
        bool previous = graduationPaused;
        if (msg.sender == owner()) {
            graduationPaused = paused;
        } else if (msg.sender == guardian) {
            if (!paused) revert GuardianCannotClearGraduationPause();
            graduationPaused = true;
        } else {
            revert UnauthorizedEmergencyActor();
        }

        emit GraduationPauseUpdated(msg.sender, previous, graduationPaused);
    }

    function setGuardian(address nextGuardian) external onlyOwner {
        if (nextGuardian == address(0)) revert ZeroAddress();
        address previous = guardian;
        guardian = nextGuardian;
        emit GuardianUpdated(previous, nextGuardian);
    }

    function launchesAllowed() external view override returns (bool allowed) {
        return restrictionMode == RestrictionMode.NORMAL;
    }

    function buysAllowed() external view override returns (bool allowed) {
        return uint8(restrictionMode) < uint8(RestrictionMode.BUY_PAUSED);
    }

    function sellsAllowed() external view override returns (bool allowed) {
        return restrictionMode != RestrictionMode.TRADING_PAUSED;
    }

    function renounceOwnership() public pure override {
        revert OwnershipRenounceDisabled();
    }
}
