// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadEmergencyController} from "../src/security/BreadEmergencyController.sol";
import {IBreadEmergencyController} from "../src/interfaces/IBreadEmergencyController.sol";

contract BreadEmergencyActor {
    function setRestrictionMode(BreadEmergencyController controller, IBreadEmergencyController.RestrictionMode next)
        external
    {
        controller.setRestrictionMode(next);
    }

    function setGraduationPaused(BreadEmergencyController controller, bool paused) external {
        controller.setGraduationPaused(paused);
    }

    function setGuardian(BreadEmergencyController controller, address nextGuardian) external {
        controller.setGuardian(nextGuardian);
    }

    function renounceOwnership(BreadEmergencyController controller) external {
        controller.renounceOwnership();
    }
}

contract BreadEmergencyControllerTest {
    function testInitialModeAllowsAllUserPaths() public {
        BreadEmergencyActor guardian = new BreadEmergencyActor();
        BreadEmergencyController controller = new BreadEmergencyController(address(this), address(guardian));

        assert(controller.owner() == address(this));
        assert(controller.guardian() == address(guardian));
        assert(uint8(controller.restrictionMode()) == uint8(IBreadEmergencyController.RestrictionMode.NORMAL));
        assert(!controller.graduationPaused());
        assert(controller.launchesAllowed());
        assert(controller.buysAllowed());
        assert(controller.sellsAllowed());
    }

    function testConstructorRejectsZeroProtocolAdminAndZeroGuardian() public {
        BreadEmergencyActor guardian = new BreadEmergencyActor();

        bool zeroAdminReverted;
        try new BreadEmergencyController(address(0), address(guardian)) returns (BreadEmergencyController) {
            zeroAdminReverted = false;
        } catch {
            zeroAdminReverted = true;
        }

        bool zeroGuardianReverted;
        try new BreadEmergencyController(address(this), address(0)) returns (BreadEmergencyController) {
            zeroGuardianReverted = false;
        } catch {
            zeroGuardianReverted = true;
        }

        assert(zeroAdminReverted);
        assert(zeroGuardianReverted);
    }

    function testRestrictionModePermissionsMatchFrozenMatrix() public {
        BreadEmergencyActor guardian = new BreadEmergencyActor();
        BreadEmergencyController controller = new BreadEmergencyController(address(this), address(guardian));

        guardian.setRestrictionMode(controller, IBreadEmergencyController.RestrictionMode.NO_NEW_LAUNCHES);
        assert(!controller.launchesAllowed());
        assert(controller.buysAllowed());
        assert(controller.sellsAllowed());

        guardian.setRestrictionMode(controller, IBreadEmergencyController.RestrictionMode.BUY_PAUSED);
        assert(!controller.launchesAllowed());
        assert(!controller.buysAllowed());
        assert(controller.sellsAllowed());

        guardian.setRestrictionMode(controller, IBreadEmergencyController.RestrictionMode.TRADING_PAUSED);
        assert(!controller.launchesAllowed());
        assert(!controller.buysAllowed());
        assert(!controller.sellsAllowed());
    }

    function testGuardianCanJumpOrRepeatUpwardRestrictionButCannotLower() public {
        BreadEmergencyActor guardian = new BreadEmergencyActor();
        BreadEmergencyController controller = new BreadEmergencyController(address(this), address(guardian));

        guardian.setRestrictionMode(controller, IBreadEmergencyController.RestrictionMode.BUY_PAUSED);
        assert(uint8(controller.restrictionMode()) == uint8(IBreadEmergencyController.RestrictionMode.BUY_PAUSED));

        guardian.setRestrictionMode(controller, IBreadEmergencyController.RestrictionMode.BUY_PAUSED);
        assert(uint8(controller.restrictionMode()) == uint8(IBreadEmergencyController.RestrictionMode.BUY_PAUSED));

        (bool lowerOk,) = address(guardian).call(
            abi.encodeWithSelector(
                BreadEmergencyActor.setRestrictionMode.selector,
                controller,
                IBreadEmergencyController.RestrictionMode.NO_NEW_LAUNCHES
            )
        );
        assert(!lowerOk);
        assert(uint8(controller.restrictionMode()) == uint8(IBreadEmergencyController.RestrictionMode.BUY_PAUSED));

        guardian.setRestrictionMode(controller, IBreadEmergencyController.RestrictionMode.TRADING_PAUSED);
        assert(uint8(controller.restrictionMode()) == uint8(IBreadEmergencyController.RestrictionMode.TRADING_PAUSED));
    }

    function testGuardianCanPauseGraduationButCannotClearIt() public {
        BreadEmergencyActor guardian = new BreadEmergencyActor();
        BreadEmergencyController controller = new BreadEmergencyController(address(this), address(guardian));

        guardian.setGraduationPaused(controller, true);
        assert(controller.graduationPaused());

        (bool clearOk,) = address(guardian).call(
            abi.encodeWithSelector(BreadEmergencyActor.setGraduationPaused.selector, controller, false)
        );
        assert(!clearOk);
        assert(controller.graduationPaused());
    }

    function testProtocolAdminCanTightenLoosenAndClearGraduationPause() public {
        BreadEmergencyActor guardian = new BreadEmergencyActor();
        BreadEmergencyController controller = new BreadEmergencyController(address(this), address(guardian));

        controller.setRestrictionMode(IBreadEmergencyController.RestrictionMode.TRADING_PAUSED);
        controller.setGraduationPaused(true);
        assert(!controller.sellsAllowed());
        assert(controller.graduationPaused());

        controller.setRestrictionMode(IBreadEmergencyController.RestrictionMode.NORMAL);
        controller.setGraduationPaused(false);
        assert(controller.launchesAllowed());
        assert(controller.buysAllowed());
        assert(controller.sellsAllowed());
        assert(!controller.graduationPaused());
    }

    function testUnauthorizedCallerCannotMutateEmergencyState() public {
        BreadEmergencyActor guardian = new BreadEmergencyActor();
        BreadEmergencyActor outsider = new BreadEmergencyActor();
        BreadEmergencyController controller = new BreadEmergencyController(address(this), address(guardian));

        (bool modeOk,) = address(outsider).call(
            abi.encodeWithSelector(
                BreadEmergencyActor.setRestrictionMode.selector,
                controller,
                IBreadEmergencyController.RestrictionMode.NO_NEW_LAUNCHES
            )
        );
        (bool graduationOk,) = address(outsider).call(
            abi.encodeWithSelector(BreadEmergencyActor.setGraduationPaused.selector, controller, true)
        );
        (bool guardianOk,) = address(outsider).call(
            abi.encodeWithSelector(BreadEmergencyActor.setGuardian.selector, controller, address(outsider))
        );

        assert(!modeOk);
        assert(!graduationOk);
        assert(!guardianOk);
        assert(uint8(controller.restrictionMode()) == uint8(IBreadEmergencyController.RestrictionMode.NORMAL));
        assert(!controller.graduationPaused());
        assert(controller.guardian() == address(guardian));
    }

    function testProtocolAdminCanRotateGuardianAndOldGuardianLosesAuthority() public {
        BreadEmergencyActor firstGuardian = new BreadEmergencyActor();
        BreadEmergencyActor nextGuardian = new BreadEmergencyActor();
        BreadEmergencyController controller = new BreadEmergencyController(address(this), address(firstGuardian));

        controller.setGuardian(address(nextGuardian));
        assert(controller.guardian() == address(nextGuardian));

        (bool oldOk,) = address(firstGuardian).call(
            abi.encodeWithSelector(
                BreadEmergencyActor.setRestrictionMode.selector,
                controller,
                IBreadEmergencyController.RestrictionMode.NO_NEW_LAUNCHES
            )
        );
        assert(!oldOk);

        nextGuardian.setRestrictionMode(controller, IBreadEmergencyController.RestrictionMode.NO_NEW_LAUNCHES);
        assert(!controller.launchesAllowed());
    }

    function testGuardianRotationRejectsZeroAddress() public {
        BreadEmergencyActor guardian = new BreadEmergencyActor();
        BreadEmergencyController controller = new BreadEmergencyController(address(this), address(guardian));

        (bool ok,) = address(controller).call(
            abi.encodeWithSelector(BreadEmergencyController.setGuardian.selector, address(0))
        );
        assert(!ok);
        assert(controller.guardian() == address(guardian));
    }

    function testOwnershipCannotBeRenouncedIntoPermanentlyRestrictedState() public {
        BreadEmergencyActor guardian = new BreadEmergencyActor();
        BreadEmergencyController controller = new BreadEmergencyController(address(this), address(guardian));
        controller.setRestrictionMode(IBreadEmergencyController.RestrictionMode.TRADING_PAUSED);

        (bool ok,) = address(controller).call(
            abi.encodeWithSelector(BreadEmergencyController.renounceOwnership.selector)
        );

        assert(!ok);
        assert(controller.owner() == address(this));
        assert(uint8(controller.restrictionMode()) == uint8(IBreadEmergencyController.RestrictionMode.TRADING_PAUSED));
    }
}
