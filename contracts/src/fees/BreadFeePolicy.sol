// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {BreadFeePolicySnapshot} from "../interfaces/IBreadFeePolicy.sol";

/// @title BreadFeePolicy
/// @notice Future-launch fee configuration whose values are copied into each Bread curve at launch.
contract BreadFeePolicy is Ownable {
    uint16 private constant MAX_COMBINED_TRADE_FEE_BPS = 2_000;

    error ProtocolFeeRecipientZeroAddress();
    error TradeFeeInvalid(uint16 tradeFeeBps);
    error ProtocolFeeShareInvalid(uint16 protocolFeeShareBps);
    error CreatorTaxInvalid(uint16 maxCreatorTaxBps);
    error CombinedTradeFeeInvalid(uint16 tradeFeeBps, uint16 maxCreatorTaxBps);

    BreadFeePolicySnapshot private _currentFeePolicy;
    address public feeSweepOperator;

    constructor(
        address owner_,
        BreadFeePolicySnapshot memory initialPolicy,
        address initialSweepOperator
    ) Ownable(owner_) {
        _validatePolicy(initialPolicy);
        _currentFeePolicy = initialPolicy;
        feeSweepOperator = initialSweepOperator;
    }

    function currentFeePolicy() external view returns (BreadFeePolicySnapshot memory policy) {
        return _currentFeePolicy;
    }

    function _validatePolicy(BreadFeePolicySnapshot memory policy) private pure {
        if (policy.protocolFeeRecipient == address(0)) revert ProtocolFeeRecipientZeroAddress();
        if (policy.tradeFeeBps >= 10_000) revert TradeFeeInvalid(policy.tradeFeeBps);
        if (policy.protocolFeeShareBps > 10_000) revert ProtocolFeeShareInvalid(policy.protocolFeeShareBps);
        if (policy.maxCreatorTaxBps >= 10_000) revert CreatorTaxInvalid(policy.maxCreatorTaxBps);
        if (uint256(policy.tradeFeeBps) + uint256(policy.maxCreatorTaxBps) > MAX_COMBINED_TRADE_FEE_BPS) {
            revert CombinedTradeFeeInvalid(policy.tradeFeeBps, policy.maxCreatorTaxBps);
        }
    }
}
