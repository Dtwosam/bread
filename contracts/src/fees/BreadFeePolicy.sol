// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {BreadFeePolicySnapshot} from "../interfaces/IBreadFeePolicy.sol";

/// @title BreadFeePolicy
/// @notice Future-launch fee configuration whose values are copied into each Bread curve at launch.
contract BreadFeePolicy is Ownable {
    BreadFeePolicySnapshot private _currentFeePolicy;
    address public feeSweepOperator;

    constructor(
        address owner_,
        BreadFeePolicySnapshot memory initialPolicy,
        address initialSweepOperator
    ) Ownable(owner_) {
        _currentFeePolicy = initialPolicy;
        feeSweepOperator = initialSweepOperator;
    }

    function currentFeePolicy() external view returns (BreadFeePolicySnapshot memory policy) {
        return _currentFeePolicy;
    }
}
