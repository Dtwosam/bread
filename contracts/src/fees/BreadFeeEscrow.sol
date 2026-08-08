// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title BreadFeeEscrow
/// @notice Canonical-USDC recipient ledger for Bread fee claims.
contract BreadFeeEscrow is Ownable {
    using SafeERC20 for IERC20;

    error UnauthorizedCreditor();
    error UnexpectedReceivedAmount(uint256 expected, uint256 received);

    IERC20 public immutable usdc;

    mapping(address recipient => uint256 amount) public balanceOf;
    mapping(address creditor => bool allowed) public authorizedCreditor;

    uint256 public totalOutstanding;

    event AuthorizedCreditorUpdated(address indexed creditor, bool allowed);
    event FeeCredited(
        address indexed creditor,
        address indexed recipient,
        uint256 amount,
        uint256 recipientBalance,
        uint256 totalOutstanding
    );

    constructor(address usdc_, address owner_) Ownable(owner_) {
        usdc = IERC20(usdc_);
    }

    function setAuthorizedCreditor(address creditor, bool allowed) external onlyOwner {
        authorizedCreditor[creditor] = allowed;
        emit AuthorizedCreditorUpdated(creditor, allowed);
    }

    function credit(address recipient, uint256 amount) external {
        if (!authorizedCreditor[msg.sender]) revert UnauthorizedCreditor();

        uint256 balanceBefore = usdc.balanceOf(address(this));
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = usdc.balanceOf(address(this)) - balanceBefore;
        if (received != amount) revert UnexpectedReceivedAmount(amount, received);

        uint256 recipientBalance = balanceOf[recipient] + received;
        balanceOf[recipient] = recipientBalance;
        totalOutstanding += received;

        emit FeeCredited(msg.sender, recipient, received, recipientBalance, totalOutstanding);
    }

    function surplus() external view returns (uint256 amount) {
        uint256 custody = usdc.balanceOf(address(this));
        return custody > totalOutstanding ? custody - totalOutstanding : 0;
    }
}
