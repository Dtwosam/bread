// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IGraduationAdapter} from "../../src/interfaces/IGraduationAdapter.sol";
import {MockPositionManagerNFT} from "./MockPositionManagerNFT.sol";

contract MockGraduationAdapter is IGraduationAdapter {
    using SafeERC20 for IERC20;

    AdapterFamily private immutable _family;
    address public immutable override usdc;
    address public immutable override locker;
    bytes32 public immutable override configHash;

    bool public failValidation;
    bool public failExecution;
    bool public failAfterPull;
    bool public failAfterMint;
    uint256 public executeCalls;
    uint256 public successfulMints;
    MockPositionManagerNFT public positionManager;
    Seed private _lastSeed;
    Result private _nextResult;

    constructor(AdapterFamily family_, address usdc_, address locker_, bytes32 configHash_) {
        _family = family_;
        usdc = usdc_;
        locker = locker_;
        configHash = configHash_;
    }

    function family() external view override returns (AdapterFamily) {
        return _family;
    }

    function setFailValidation(bool fail) external {
        failValidation = fail;
    }

    function setFailExecution(bool fail) external {
        failExecution = fail;
    }

    function setFailAfterPull(bool fail) external {
        failAfterPull = fail;
    }

    function setFailAfterMint(bool fail) external {
        failAfterMint = fail;
    }

    function setPositionManager(MockPositionManagerNFT manager) external {
        positionManager = manager;
    }

    function setNextResult(Result calldata result) external {
        _nextResult = result;
    }

    function validateSeed(Seed calldata) external view override {
        if (failValidation) revert("MOCK_VALIDATE_REVERT");
    }

    function execute(Seed calldata seed) external override returns (Result memory result) {
        if (failExecution) revert("MOCK_EXECUTE_REVERT");
        ++executeCalls;
        _lastSeed = seed;

        MockPositionManagerNFT manager = positionManager;
        if (address(manager) == address(0)) return _nextResult;

        IERC20(seed.usdc).safeTransferFrom(msg.sender, address(this), seed.usdcAmount);
        IERC20(seed.token).safeTransferFrom(msg.sender, address(this), seed.poolTokenAmount);
        if (failAfterPull) revert("MOCK_AFTER_PULL_REVERT");

        result = _nextResult;
        if (result.poolId == bytes32(0)) result.poolId = keccak256(abi.encode(seed.token, seed.configHash));
        if (result.usdcUsed == 0 && result.usdcDust == 0) result.usdcUsed = seed.usdcAmount;
        if (result.tokenUsed == 0 && result.tokenDust == 0) result.tokenUsed = seed.poolTokenAmount;

        if (result.usdcDust != 0) IERC20(seed.usdc).safeTransfer(msg.sender, result.usdcDust);
        if (result.tokenDust != 0) IERC20(seed.token).safeTransfer(msg.sender, result.tokenDust);

        uint256 positionId = manager.mint(locker);
        result.positionManager = address(manager);
        result.positionId = positionId;
        if (failAfterMint) revert("MOCK_AFTER_MINT_REVERT");

        ++successfulMints;
        return result;
    }

    function lastSeed() external view returns (Seed memory seed) {
        return _lastSeed;
    }
}
