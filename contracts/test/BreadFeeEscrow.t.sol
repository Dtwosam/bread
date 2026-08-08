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

    function testDirectDonationIsSurplusOnly() public {
        MockUSDC6 usdc = new MockUSDC6();
        BreadFeeEscrow escrow = new BreadFeeEscrow(address(usdc), address(this));

        uint256 donation = 7 * ONE_USDC;
        usdc.mint(address(this), donation);
        assert(usdc.transfer(address(escrow), donation));

        assert(usdc.balanceOf(address(escrow)) == donation);
        assert(escrow.balanceOf(RECIPIENT) == 0);
        assert(escrow.totalOutstanding() == 0);
        assert(escrow.surplus() == donation);
    }

    function testFullClaimDebitsLedgerOutstandingAndCustody() public {
        MockUSDC6 usdc = new MockUSDC6();
        BreadFeeEscrow escrow = new BreadFeeEscrow(address(usdc), address(this));
        escrow.setAuthorizedCreditor(address(this), true);

        uint256 amount = 11 * ONE_USDC;
        usdc.mint(address(this), amount);
        assert(usdc.approve(address(escrow), amount));
        escrow.credit(address(this), amount);

        assert(usdc.balanceOf(address(this)) == 0);
        uint256 claimed = escrow.claim();

        assert(claimed == amount);
        assert(usdc.balanceOf(address(this)) == amount);
        assert(usdc.balanceOf(address(escrow)) == 0);
        assert(escrow.balanceOf(address(this)) == 0);
        assert(escrow.totalOutstanding() == 0);
    }

    function testPartialClaimDebitsOnlyRequestedAmount() public {
        MockUSDC6 usdc = new MockUSDC6();
        BreadFeeEscrow escrow = new BreadFeeEscrow(address(usdc), address(this));
        escrow.setAuthorizedCreditor(address(this), true);

        uint256 amount = 13 * ONE_USDC;
        uint256 partial = 4 * ONE_USDC;
        usdc.mint(address(this), amount);
        assert(usdc.approve(address(escrow), amount));
        escrow.credit(address(this), amount);

        uint256 claimed = escrow.claim(partial);

        assert(claimed == partial);
        assert(usdc.balanceOf(address(this)) == partial);
        assert(usdc.balanceOf(address(escrow)) == amount - partial);
        assert(escrow.balanceOf(address(this)) == amount - partial);
        assert(escrow.totalOutstanding() == amount - partial);
    }
}
