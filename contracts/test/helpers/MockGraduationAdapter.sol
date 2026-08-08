// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IGraduationAdapter} from "../../src/interfaces/IGraduationAdapter.sol";

contract MockGraduationAdapter is IGraduationAdapter {
    AdapterFamily private immutable _family;
    address public immutable override usdc;
    address public immutable override locker;
    bytes32 public immutable override configHash;

    bool public failValidation;
    bool public failExecution;
    uint256 public executeCalls;
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
        return _nextResult;
    }

    function lastSeed() external view returns (Seed memory seed) {
        return _lastSeed;
    }
}
