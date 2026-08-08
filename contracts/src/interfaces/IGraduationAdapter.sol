// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IGraduationAdapter
/// @notice DEX-neutral execution boundary for one snapshotted Bread graduation destination.
interface IGraduationAdapter {
    enum AdapterFamily {
        NONE,
        UNISWAP_V4,
        UNISWAP_V3
    }

    struct Seed {
        address token;
        address usdc;
        uint256 usdcAmount;
        uint256 totalTokenAmount;
        uint256 poolTokenAmount;
        bytes32 configHash;
    }

    struct Result {
        bytes32 poolId;
        address positionManager;
        uint256 positionId;
        uint256 usdcUsed;
        uint256 tokenUsed;
        uint256 usdcDust;
        uint256 tokenDust;
    }

    function family() external view returns (AdapterFamily);

    function usdc() external view returns (address);

    function locker() external view returns (address);

    function configHash() external view returns (bytes32);

    function validateSeed(Seed calldata seed) external view;

    function execute(Seed calldata seed) external returns (Result memory result);
}
