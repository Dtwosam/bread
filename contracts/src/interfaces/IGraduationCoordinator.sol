// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IGraduationCoordinator
/// @notice Canonical Bread graduation phase/custody boundary.
interface IGraduationCoordinator {
    enum GraduationPhase {
        NOT_GRADUATED,
        SWEPT,
        POOL_CREATED,
        RESCUED
    }

    struct GraduationRecord {
        GraduationPhase phase;
        uint64 sweptAt;
        uint256 sweptUsdc;
        uint256 sweptTokens;
        uint256 poolTokenAmount;
        bytes32 poolId;
        address positionManager;
        uint256 positionId;
    }

    function factory() external view returns (address);

    function usdc() external view returns (address);

    function feeEscrow() external view returns (address);

    function emergencyController() external view returns (address);

    function locker() external view returns (address);

    function sweep(address token) external;

    function createPool(address token) external returns (bytes32 poolId, uint256 positionId);

    function getGraduation(address token) external view returns (GraduationRecord memory record);
}
