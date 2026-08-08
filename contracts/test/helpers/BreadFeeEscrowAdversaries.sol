// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {BreadFeeEscrow} from "../../src/fees/BreadFeeEscrow.sol";

contract ToggleFailUSDC6 is ERC20 {
    bool public failTransfers;

    constructor() ERC20("Toggle Fail USDC", "tfUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setFailTransfers(bool next) external {
        failTransfers = next;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (failTransfers) revert("TRANSFER_DISABLED");
        return super.transfer(to, amount);
    }
}

contract FeeEscrowExternalCaller {
    function credit(BreadFeeEscrow escrow, address recipient, uint256 amount) external {
        escrow.credit(recipient, amount);
    }

    function setAuthorizedCreditor(BreadFeeEscrow escrow, address creditor, bool allowed) external {
        escrow.setAuthorizedCreditor(creditor, allowed);
    }
}
