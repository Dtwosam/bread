// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadFeeEscrow} from "../src/fees/BreadFeeEscrow.sol";
import {MockUSDC6} from "./helpers/MockUSDC6.sol";

contract BreadFeeEscrowTest {
    uint256 private constant ONE_USDC = 1_000_000;
    address private constant RECIPIENT = address(0xBEEF);

    function testAuthorizedCreditReconcilesCustodyLedgerAndOutstanding() public {
        MockUSDC6 usdc = new MockUSDC6();
        BreadFeeEscrow escrow = new BreadFeeEscrow(address(usdc), address(this));

        escrow.setAuthorizedCreditor(address(this), true);

        uint256 amount = 5 * ONE_USDC;
        usdc.mint(address(this), amount);
        assert(usdc.approve(address(escrow), amount));

        escrow.credit(RECIPIENT, amount);

        assert(usdc.balanceOf(address(escrow)) == amount);
        assert(escrow.balanceOf(RECIPIENT) == amount);
        assert(escrow.totalOutstanding() == amount);
    }
}
