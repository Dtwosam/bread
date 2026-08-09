// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../../src/core/BreadBondingCurve.sol";
import {IGraduationCoordinator} from "../../src/interfaces/IGraduationCoordinator.sol";

contract MockGraduationCoordinator is IGraduationCoordinator {
    address public immutable override factory;
    address public immutable override usdc;
    address public immutable override feeEscrow;
    address public immutable override emergencyController;
    address public immutable override locker;

    bool public failSweep;
    bool public failCreatePool;
    uint256 public sweepCalls;
    uint256 public createPoolCalls;

    bytes32 public nextPoolId;
    uint256 public nextPositionId;

    mapping(address token => GraduationRecord record) private _graduations;

    constructor(address factory_, address usdc_, address feeEscrow_, address emergencyController_, address locker_) {
        factory = factory_;
        usdc = usdc_;
        feeEscrow = feeEscrow_;
        emergencyController = emergencyController_;
        locker = locker_;
    }

    function setFailSweep(bool fail) external {
        failSweep = fail;
    }

    function setFailCreatePool(bool fail) external {
        failCreatePool = fail;
    }

    function setNextPoolResult(bytes32 poolId, uint256 positionId) external {
        nextPoolId = poolId;
        nextPositionId = positionId;
    }

    function setGraduation(address token, GraduationRecord calldata record) external {
        _graduations[token] = record;
    }

    function sweep(address) external override {
        if (failSweep) revert("MOCK_SWEEP_REVERT");
        ++sweepCalls;
    }

    function createPool(address) external override returns (bytes32 poolId, uint256 positionId) {
        if (failCreatePool) revert("MOCK_CREATE_POOL_REVERT");
        ++createPoolCalls;
        return (nextPoolId, nextPositionId);
    }

    function getGraduation(address token) external view override returns (GraduationRecord memory record) {
        return _graduations[token];
    }

    function releaseCurve(BreadBondingCurve curve)
        external
        returns (uint256 seedUsdc, uint256 tokenOut, uint256 protocolFeeAmount, uint256 creatorFeeAmount)
    {
        return curve.releaseForGraduation();
    }
}
