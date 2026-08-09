// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IERC721OwnerOf {
    function ownerOf(uint256 tokenId) external view returns (address owner);
}

/// @title BreadPermanentLiquidityLocker
/// @notice Capability-minimal permanent custody for graduated LP positions and locked launch-token residue.
/// @dev The wiring authority has exactly one capability: bind the coordinator once. It has no principal custody path.
contract BreadPermanentLiquidityLocker {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error NotWiringAuthority();
    error AlreadyInitialized();
    error InvalidCoordinator();
    error NotCoordinator();
    error PositionAlreadyLocked();
    error PositionNotHeld();
    error UnexpectedReceivedAmount(uint256 expected, uint256 actual);

    struct LockedPosition {
        address positionManager;
        uint256 positionId;
    }

    address public immutable wiringAuthority;
    address public coordinator;

    mapping(address token => LockedPosition position) private _positions;
    mapping(address token => uint256 amount) public lockedTokenSupply;

    event CoordinatorSet(address indexed coordinator);
    event PositionLocked(address indexed token, address indexed positionManager, uint256 indexed positionId);
    event TokenSupplyLocked(address indexed token, uint256 amount, uint256 totalLocked);

    modifier onlyCoordinator() {
        if (msg.sender != coordinator) revert NotCoordinator();
        _;
    }

    constructor(address wiringAuthority_) {
        if (wiringAuthority_ == address(0)) revert ZeroAddress();
        wiringAuthority = wiringAuthority_;
    }

    /// @notice Binds the sole coordinator once. No later rewiring is possible.
    function setCoordinator(address next) external {
        if (msg.sender != wiringAuthority) revert NotWiringAuthority();
        if (coordinator != address(0)) revert AlreadyInitialized();
        if (next == address(0) || next.code.length == 0) revert InvalidCoordinator();
        coordinator = next;
        emit CoordinatorSet(next);
    }

    /// @notice Registers an LP position only after verifying the locker already owns it.
    function lockPosition(address token, address positionManager, uint256 positionId) external onlyCoordinator {
        if (token == address(0) || positionManager == address(0)) revert ZeroAddress();
        if (_positions[token].positionManager != address(0)) revert PositionAlreadyLocked();
        if (IERC721OwnerOf(positionManager).ownerOf(positionId) != address(this)) revert PositionNotHeld();

        _positions[token] = LockedPosition({positionManager: positionManager, positionId: positionId});
        emit PositionLocked(token, positionManager, positionId);
    }

    /// @notice Permanently receives launch-token residue from the coordinator using exact-transfer accounting.
    function lockTokenSupply(address token, uint256 amount) external onlyCoordinator {
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) return;

        IERC20 asset = IERC20(token);
        uint256 beforeBalance = asset.balanceOf(address(this));
        asset.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = asset.balanceOf(address(this)) - beforeBalance;
        if (received != amount) revert UnexpectedReceivedAmount(amount, received);

        uint256 totalLocked = lockedTokenSupply[token] + received;
        lockedTokenSupply[token] = totalLocked;
        emit TokenSupplyLocked(token, received, totalLocked);
    }

    function isPositionLocked(address token) external view returns (bool locked) {
        return _positions[token].positionManager != address(0);
    }

    function lockedPosition(address token) external view returns (address positionManager, uint256 positionId) {
        LockedPosition memory position = _positions[token];
        return (position.positionManager, position.positionId);
    }
}
