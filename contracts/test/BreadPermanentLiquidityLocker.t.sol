// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadPermanentLiquidityLocker} from "../src/graduation/BreadPermanentLiquidityLocker.sol";
import {MockPositionManagerNFT} from "./helpers/MockPositionManagerNFT.sol";
import {MockUSDC6} from "./helpers/MockUSDC6.sol";

contract BreadLockerExternalCaller {
    function setCoordinator(BreadPermanentLiquidityLocker locker, address next) external returns (bool ok) {
        (ok,) = address(locker).call(abi.encodeWithSelector(locker.setCoordinator.selector, next));
    }

    function lockPosition(
        BreadPermanentLiquidityLocker locker,
        address token,
        address manager,
        uint256 positionId
    ) external returns (bool ok) {
        (ok,) = address(locker).call(
            abi.encodeWithSelector(locker.lockPosition.selector, token, manager, positionId)
        );
    }
}

contract BreadPermanentLiquidityLockerTest {
    function testCoordinatorWiringIsOneTimeAndAuthorityBound() public {
        BreadPermanentLiquidityLocker locker = new BreadPermanentLiquidityLocker(address(this));
        BreadLockerExternalCaller outsider = new BreadLockerExternalCaller();

        assert(!outsider.setCoordinator(locker, address(outsider)));
        locker.setCoordinator(address(this));
        assert(locker.coordinator() == address(this));

        (bool secondSet,) = address(locker).call(
            abi.encodeWithSelector(locker.setCoordinator.selector, address(outsider))
        );
        assert(!secondSet);
        assert(locker.coordinator() == address(this));
    }

    function testOnlyCoordinatorCanRegisterActuallyHeldPositionOnce() public {
        BreadPermanentLiquidityLocker locker = _wiredLocker();
        MockPositionManagerNFT manager = new MockPositionManagerNFT();
        BreadLockerExternalCaller outsider = new BreadLockerExternalCaller();
        address launchToken = address(0xBEEF);

        uint256 wrongOwnerId = manager.mint(address(this));
        (bool wrongOwner,) = address(locker).call(
            abi.encodeWithSelector(locker.lockPosition.selector, launchToken, address(manager), wrongOwnerId)
        );
        assert(!wrongOwner);

        uint256 positionId = manager.mint(address(locker));
        assert(!outsider.lockPosition(locker, launchToken, address(manager), positionId));

        locker.lockPosition(launchToken, address(manager), positionId);
        assert(locker.isPositionLocked(launchToken));
        (address recordedManager, uint256 recordedId) = locker.lockedPosition(launchToken);
        assert(recordedManager == address(manager));
        assert(recordedId == positionId);
        assert(manager.ownerOf(positionId) == address(locker));

        (bool duplicate,) = address(locker).call(
            abi.encodeWithSelector(locker.lockPosition.selector, launchToken, address(manager), positionId)
        );
        assert(!duplicate);
    }

    function testLockedTokenSupplyIsExactAndCannotBeReducedByEscapeCalls() public {
        BreadPermanentLiquidityLocker locker = _wiredLocker();
        MockUSDC6 token = new MockUSDC6();
        uint256 amount = 123_456;
        token.mint(address(this), amount);
        assert(token.approve(address(locker), amount));

        locker.lockTokenSupply(address(token), amount);
        assert(locker.lockedTokenSupply(address(token)) == amount);
        assert(token.balanceOf(address(locker)) == amount);

        bytes4[6] memory selectors = [
            bytes4(keccak256("withdraw(address,uint256)")),
            bytes4(keccak256("rescue(address,address,uint256)")),
            bytes4(keccak256("execute(address,bytes)")),
            bytes4(keccak256("transferPosition(address,address)")),
            bytes4(keccak256("approvePosition(address,address)")),
            bytes4(keccak256("upgradeToAndCall(address,bytes)"))
        ];

        for (uint256 i = 0; i < selectors.length; ++i) {
            (bool ok,) = address(locker).call(abi.encodeWithSelector(selectors[i], address(token), amount));
            assert(!ok);
            assert(locker.lockedTokenSupply(address(token)) == amount);
            assert(token.balanceOf(address(locker)) == amount);
        }
    }

    function _wiredLocker() private returns (BreadPermanentLiquidityLocker locker) {
        locker = new BreadPermanentLiquidityLocker(address(this));
        locker.setCoordinator(address(this));
    }
}
