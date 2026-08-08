// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadFeeEscrow} from "../src/fees/BreadFeeEscrow.sol";
import {MockUSDC6} from "./helpers/MockUSDC6.sol";
import {BreadFeeClaimRecipient} from "./helpers/BreadTradingActors.sol";

contract BreadFeeEscrowInvariantTest {
    function testFuzz_SequentialCreditsClaimsAndDonationPreserveSolvency(
        uint96 rawFirstCredit,
        uint96 rawSecondCredit,
        uint96 rawFirstClaim,
        uint96 rawSecondClaim,
        uint64 rawDonation
    ) public {
        MockUSDC6 usdc = new MockUSDC6();
        BreadFeeEscrow escrow = new BreadFeeEscrow(address(usdc), address(this));
        BreadFeeClaimRecipient secondRecipient = new BreadFeeClaimRecipient();
        escrow.setAuthorizedCreditor(address(this), true);

        uint256 firstCredit = (uint256(rawFirstCredit) % 1_000_000_000_000) + 1;
        uint256 secondCredit = (uint256(rawSecondCredit) % 1_000_000_000_000) + 1;
        uint256 donation = uint256(rawDonation) % 1_000_000_000;
        uint256 totalFunding = firstCredit + secondCredit + donation;

        usdc.mint(address(this), totalFunding);
        assert(usdc.approve(address(escrow), firstCredit + secondCredit));
        escrow.credit(address(this), firstCredit);
        escrow.credit(address(secondRecipient), secondCredit);
        if (donation != 0) assert(usdc.transfer(address(escrow), donation));

        _assertSolvent(escrow, usdc, address(secondRecipient), donation);

        uint256 firstClaim = (uint256(rawFirstClaim) % firstCredit) + 1;
        uint256 secondClaim = (uint256(rawSecondClaim) % secondCredit) + 1;
        escrow.claim(firstClaim);
        secondRecipient.claim(escrow, secondClaim);

        _assertSolvent(escrow, usdc, address(secondRecipient), donation);

        uint256 firstRemaining = escrow.balanceOf(address(this));
        uint256 secondRemaining = escrow.balanceOf(address(secondRecipient));
        if (firstRemaining != 0) escrow.claim(firstRemaining);
        if (secondRemaining != 0) secondRecipient.claim(escrow, secondRemaining);

        assert(escrow.totalOutstanding() == 0);
        assert(escrow.balanceOf(address(this)) == 0);
        assert(escrow.balanceOf(address(secondRecipient)) == 0);
        assert(usdc.balanceOf(address(escrow)) == donation);
        assert(escrow.surplus() == donation);
    }

    function _assertSolvent(
        BreadFeeEscrow escrow,
        MockUSDC6 usdc,
        address secondRecipient,
        uint256 expectedSurplus
    ) private view {
        uint256 firstBalance = escrow.balanceOf(address(this));
        uint256 secondBalance = escrow.balanceOf(secondRecipient);
        uint256 outstanding = escrow.totalOutstanding();
        uint256 custody = usdc.balanceOf(address(escrow));

        assert(firstBalance + secondBalance == outstanding);
        assert(custody >= outstanding);
        assert(custody - outstanding == expectedSurplus);
        assert(escrow.surplus() == expectedSurplus);
    }
}
