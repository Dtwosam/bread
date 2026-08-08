// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

struct BreadFeePolicySnapshot {
    address protocolFeeRecipient;
    uint16 tradeFeeBps;
    uint16 protocolFeeShareBps;
    uint16 maxCreatorTaxBps;
}

interface IBreadFeePolicy {
    function currentFeePolicy() external view returns (BreadFeePolicySnapshot memory policy);
    function feeSweepOperator() external view returns (address operator);
    function setCurrentFeePolicy(BreadFeePolicySnapshot calldata nextPolicy) external;
    function setFeeSweepOperator(address nextOperator) external;
}
