// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IBreadFeeEscrow {
    event AuthorizedCreditorUpdated(address indexed creditor, bool allowed);
    event FeeCredited(
        address indexed creditor,
        address indexed recipient,
        uint256 amount,
        uint256 recipientBalance,
        uint256 totalOutstanding
    );
    event FeeClaimed(
        address indexed recipient,
        uint256 amount,
        uint256 remainingBalance,
        uint256 totalOutstanding
    );

    function balanceOf(address recipient) external view returns (uint256 amount);
    function authorizedCreditor(address creditor) external view returns (bool allowed);
    function totalOutstanding() external view returns (uint256 amount);
    function setAuthorizedCreditor(address creditor, bool allowed) external;
    function credit(address recipient, uint256 amount) external;
    function claim() external returns (uint256 amount);
    function claim(uint256 amount) external returns (uint256 claimed);
    function surplus() external view returns (uint256 amount);
}
