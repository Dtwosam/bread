// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../src/core/BreadBondingCurve.sol";
import {BreadEmergencyController} from "../src/security/BreadEmergencyController.sol";
import {IBreadEmergencyController} from "../src/interfaces/IBreadEmergencyController.sol";
import {IBreadLaunchFactory} from "../src/interfaces/IBreadLaunchFactory.sol";
import {BreadDay4Fixture} from "./helpers/BreadDay4Fixture.sol";

contract BreadDay4GuardianActor {
    function setMode(BreadEmergencyController controller, IBreadEmergencyController.RestrictionMode mode) external {
        controller.setRestrictionMode(mode);
    }

    function setGraduationPaused(BreadEmergencyController controller, bool paused) external {
        controller.setGraduationPaused(paused);
    }
}

contract BreadDay4InvariantTest is BreadDay4Fixture {
    function testFuzz_INV060_INV061GuardianCanOnlyTightenAndAdminCanRecover(uint8 rawMode) public {
        BreadDay4GuardianActor guardian = new BreadDay4GuardianActor();
        Day4Fixture memory f = _deployDay4FixtureWithGuardian(0, address(guardian));
        IBreadEmergencyController.RestrictionMode target =
            IBreadEmergencyController.RestrictionMode(uint8(rawMode % 4));

        guardian.setMode(f.emergencyController, target);
        assert(uint8(f.emergencyController.restrictionMode()) == uint8(target));

        (bool lowerOk,) = address(guardian).call(
            abi.encodeWithSelector(
                BreadDay4GuardianActor.setMode.selector,
                f.emergencyController,
                IBreadEmergencyController.RestrictionMode.NORMAL
            )
        );
        if (target == IBreadEmergencyController.RestrictionMode.NORMAL) {
            assert(lowerOk);
        } else {
            assert(!lowerOk);
            assert(uint8(f.emergencyController.restrictionMode()) == uint8(target));
        }

        guardian.setGraduationPaused(f.emergencyController, true);
        assert(f.emergencyController.graduationPaused());
        (bool clearOk,) = address(guardian).call(
            abi.encodeWithSelector(BreadDay4GuardianActor.setGraduationPaused.selector, f.emergencyController, false)
        );
        assert(!clearOk);
        assert(f.emergencyController.graduationPaused());

        f.emergencyController.setRestrictionMode(IBreadEmergencyController.RestrictionMode.NORMAL);
        f.emergencyController.setGraduationPaused(false);
        assert(f.emergencyController.restrictionMode() == IBreadEmergencyController.RestrictionMode.NORMAL);
        assert(!f.emergencyController.graduationPaused());
    }

    function testFuzz_INV062FutureConfigCannotRewriteExistingLaunchSnapshot(uint64 rawDelta) public {
        Day4Fixture memory f = _deployDay4Fixture(0);
        (address tokenAddress, address curveAddress) =
            f.factory.launchToken(_day4Params(f.factory.previewLaunchEconomics()));
        BreadBondingCurve curve = BreadBondingCurve(curveAddress);
        IBreadLaunchFactory.LaunchRecord memory beforeRecord = f.factory.getLaunch(tokenAddress);
        uint256 phantomBefore = curve.phantomQuote();
        uint256 thresholdBefore = curve.graduationThreshold();
        uint16 feeBefore = curve.tradeFeeBps();
        uint16 shareBefore = curve.protocolFeeShareBps();
        uint16 creatorTaxBefore = curve.creatorTaxBps();
        uint64 launchTimestampBefore = curve.launchTimestamp();

        (IBreadLaunchFactory.LaunchConfig memory next,) = f.factory.currentLaunchConfig();
        uint256 delta = (uint256(rawDelta) % (100 * ONE_USDC)) + 1;
        next.phantomQuote += delta;
        next.graduationThreshold += delta;
        next.launchFeeUsdc += delta;
        f.factory.setLaunchConfig(next);

        IBreadLaunchFactory.LaunchRecord memory afterRecord = f.factory.getLaunch(tokenAddress);
        assert(afterRecord.economicsDigest == beforeRecord.economicsDigest);
        assert(afterRecord.configVersion == beforeRecord.configVersion);
        assert(afterRecord.launchTimestamp == beforeRecord.launchTimestamp);
        assert(curve.phantomQuote() == phantomBefore);
        assert(curve.graduationThreshold() == thresholdBefore);
        assert(curve.tradeFeeBps() == feeBefore);
        assert(curve.protocolFeeShareBps() == shareBefore);
        assert(curve.creatorTaxBps() == creatorTaxBefore);
        assert(curve.launchTimestamp() == launchTimestampBefore);
    }

    function test_INV063AdminSurfacesAreContractOwnerCompatible() public {
        BreadDay4GuardianActor guardian = new BreadDay4GuardianActor();
        Day4Fixture memory f = _deployDay4FixtureWithGuardian(0, address(guardian));

        assert(f.factory.owner() == address(this));
        assert(f.emergencyController.owner() == address(this));
        assert(address(this).code.length != 0);
        assert(address(guardian).code.length != 0);

        f.factory.setLaunchConfig(_nextConfig(f));
        f.emergencyController.setRestrictionMode(IBreadEmergencyController.RestrictionMode.TRADING_PAUSED);
        f.emergencyController.setRestrictionMode(IBreadEmergencyController.RestrictionMode.NORMAL);
        assert(f.emergencyController.restrictionMode() == IBreadEmergencyController.RestrictionMode.NORMAL);
    }

    function testGuardianTighteningBetweenQuoteAndExecutionBlocksWithoutMutation() public {
        BreadDay4GuardianActor guardian = new BreadDay4GuardianActor();
        Day4Fixture memory f = _deployDay4FixtureWithGuardian(0, address(guardian));
        uint256 launchQuote = 500 * ONE_USDC;
        f.usdc.mint(address(this), launchQuote);
        assert(f.usdc.approve(address(f.factory), launchQuote));
        (, address curveAddress,) = IBreadLaunchFactory(address(f.factory)).launchTokenAndBuy(
            _day4Params(f.factory.previewLaunchEconomics()), launchQuote, 0, address(this)
        );
        BreadBondingCurve curve = BreadBondingCurve(curveAddress);

        uint256 quoteIn = 100 * ONE_USDC;
        f.usdc.mint(address(this), quoteIn);
        assert(f.usdc.approve(curveAddress, quoteIn));
        uint256 userBalanceBefore = f.usdc.balanceOf(address(this));
        uint256 trackedQuoteBefore = curve.trackedQuote();
        uint256 trackedTokensBefore = curve.trackedTokens();
        uint256 feesBefore = curve.quoteFeeBalance();
        uint256 taxesBefore = curve.creatorTaxBalance();

        guardian.setMode(f.emergencyController, IBreadEmergencyController.RestrictionMode.BUY_PAUSED);
        (bool buyOk,) = curveAddress.call(
            abi.encodeWithSelector(BreadBondingCurve.buy.selector, quoteIn, 0, address(this))
        );
        assert(!buyOk);
        assert(f.usdc.balanceOf(address(this)) == userBalanceBefore);
        assert(curve.trackedQuote() == trackedQuoteBefore);
        assert(curve.trackedTokens() == trackedTokensBefore);
        assert(curve.quoteFeeBalance() == feesBefore);
        assert(curve.creatorTaxBalance() == taxesBefore);
    }

    function testStaleEconomicsPinAfterConfigMovementCannotLaunch() public {
        Day4Fixture memory f = _deployDay4Fixture(0);
        bytes32 staleDigest = f.factory.previewLaunchEconomics();
        f.factory.setLaunchConfig(_nextConfig(f));

        (bool ok,) = address(f.factory).call(
            abi.encodeWithSelector(f.factory.launchToken.selector, _day4Params(staleDigest))
        );
        assert(!ok);
    }

    function _nextConfig(Day4Fixture memory f)
        private
        view
        returns (IBreadLaunchFactory.LaunchConfig memory next)
    {
        (next,) = f.factory.currentLaunchConfig();
        next.phantomQuote += ONE_USDC;
    }
}
