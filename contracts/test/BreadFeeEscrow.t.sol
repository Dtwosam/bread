// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadFeeEscrow} from "../src/fees/BreadFeeEscrow.sol";
import {MockUSDC6} from "./helpers/MockUSDC6.sol";
import {
    ClaimObservingUSDC6,
    FeeEscrowExternalCaller,
    ShortTransferUSDC6,
    ToggleFailUSDC6
} from "./helpers/BreadFeeEscrowAdversaries.sol";

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
        uint256 partialAmount = 4 * ONE_USDC;
        usdc.mint(address(this), amount);
        assert(usdc.approve(address(escrow), amount));
        escrow.credit(address(this), amount);

        uint256 claimed = escrow.claim(partialAmount);

        assert(claimed == partialAmount);
        assert(usdc.balanceOf(address(this)) == partialAmount);
        assert(usdc.balanceOf(address(escrow)) == amount - partialAmount);
        assert(escrow.balanceOf(address(this)) == amount - partialAmount);
        assert(escrow.totalOutstanding() == amount - partialAmount);
    }

    function testPartialClaimRejectsZeroAmount() public {
        MockUSDC6 usdc = new MockUSDC6();
        BreadFeeEscrow escrow = new BreadFeeEscrow(address(usdc), address(this));
        escrow.setAuthorizedCreditor(address(this), true);

        uint256 amount = 2 * ONE_USDC;
        usdc.mint(address(this), amount);
        assert(usdc.approve(address(escrow), amount));
        escrow.credit(address(this), amount);

        (bool ok,) = address(escrow).call(abi.encodeWithSignature("claim(uint256)", 0));

        assert(!ok);
        assert(usdc.balanceOf(address(escrow)) == amount);
        assert(escrow.balanceOf(address(this)) == amount);
        assert(escrow.totalOutstanding() == amount);
    }

    function testCreditRejectsZeroRecipient() public {
        MockUSDC6 usdc = new MockUSDC6();
        BreadFeeEscrow escrow = new BreadFeeEscrow(address(usdc), address(this));
        escrow.setAuthorizedCreditor(address(this), true);

        uint256 amount = 3 * ONE_USDC;
        usdc.mint(address(this), amount);
        assert(usdc.approve(address(escrow), amount));

        (bool ok,) = address(escrow).call(
            abi.encodeWithSelector(BreadFeeEscrow.credit.selector, address(0), amount)
        );

        assert(!ok);
        assert(usdc.balanceOf(address(this)) == amount);
        assert(usdc.balanceOf(address(escrow)) == 0);
        assert(escrow.totalOutstanding() == 0);
    }

    function testCreditRejectsZeroAmount() public {
        MockUSDC6 usdc = new MockUSDC6();
        BreadFeeEscrow escrow = new BreadFeeEscrow(address(usdc), address(this));
        escrow.setAuthorizedCreditor(address(this), true);

        (bool ok,) = address(escrow).call(
            abi.encodeWithSelector(BreadFeeEscrow.credit.selector, RECIPIENT, 0)
        );

        assert(!ok);
        assert(escrow.balanceOf(RECIPIENT) == 0);
        assert(escrow.totalOutstanding() == 0);
    }

    function testConstructorRejectsZeroUsdc() public {
        bool reverted;
        try new BreadFeeEscrow(address(0), address(this)) returns (BreadFeeEscrow) {
            reverted = false;
        } catch {
            reverted = true;
        }
        assert(reverted);
    }

    function testUnauthorizedCreditRevertsBeforeCustodyMutation() public {
        MockUSDC6 usdc = new MockUSDC6();
        BreadFeeEscrow escrow = new BreadFeeEscrow(address(usdc), address(this));
        FeeEscrowExternalCaller outsider = new FeeEscrowExternalCaller();

        (bool ok,) = address(outsider).call(
            abi.encodeWithSelector(FeeEscrowExternalCaller.credit.selector, escrow, RECIPIENT, ONE_USDC)
        );

        assert(!ok);
        assert(usdc.balanceOf(address(escrow)) == 0);
        assert(escrow.balanceOf(RECIPIENT) == 0);
        assert(escrow.totalOutstanding() == 0);
    }

    function testOnlyOwnerCanChangeCreditAuthority() public {
        MockUSDC6 usdc = new MockUSDC6();
        BreadFeeEscrow escrow = new BreadFeeEscrow(address(usdc), address(this));
        FeeEscrowExternalCaller outsider = new FeeEscrowExternalCaller();

        (bool ok,) = address(outsider).call(
            abi.encodeWithSelector(
                FeeEscrowExternalCaller.setAuthorizedCreditor.selector,
                escrow,
                address(outsider),
                true
            )
        );

        assert(!ok);
        assert(!escrow.authorizedCreditor(address(outsider)));
    }

    function testOwnerCannotAuthorizeEoaAsCreditor() public {
        MockUSDC6 usdc = new MockUSDC6();
        BreadFeeEscrow escrow = new BreadFeeEscrow(address(usdc), address(this));
        address eoa = address(0xE0A);
        assert(eoa.code.length == 0);

        (bool ok,) = address(escrow).call(
            abi.encodeWithSelector(BreadFeeEscrow.setAuthorizedCreditor.selector, eoa, true)
        );

        assert(!ok);
        assert(!escrow.authorizedCreditor(eoa));
    }

    function testShortTransferCannotCreateUnderfundedClaim() public {
        ShortTransferUSDC6 usdc = new ShortTransferUSDC6();
        BreadFeeEscrow escrow = new BreadFeeEscrow(address(usdc), address(this));
        escrow.setAuthorizedCreditor(address(this), true);

        uint256 amount = 5 * ONE_USDC;
        usdc.mint(address(this), amount);
        assert(usdc.approve(address(escrow), amount));

        (bool ok,) = address(escrow).call(
            abi.encodeWithSelector(BreadFeeEscrow.credit.selector, RECIPIENT, amount)
        );

        assert(!ok);
        assert(usdc.balanceOf(address(this)) == amount);
        assert(usdc.balanceOf(address(escrow)) == 0);
        assert(escrow.balanceOf(RECIPIENT) == 0);
        assert(escrow.totalOutstanding() == 0);
    }

    function testOverClaimRevertsAndPreservesAccounting() public {
        MockUSDC6 usdc = new MockUSDC6();
        BreadFeeEscrow escrow = new BreadFeeEscrow(address(usdc), address(this));
        escrow.setAuthorizedCreditor(address(this), true);

        uint256 amount = 9 * ONE_USDC;
        usdc.mint(address(this), amount);
        assert(usdc.approve(address(escrow), amount));
        escrow.credit(address(this), amount);

        (bool ok,) = address(escrow).call(abi.encodeWithSignature("claim(uint256)", amount + 1));

        assert(!ok);
        assert(usdc.balanceOf(address(escrow)) == amount);
        assert(escrow.balanceOf(address(this)) == amount);
        assert(escrow.totalOutstanding() == amount);
    }

    function testClaimTransferFailurePreservesClaimAndOutstanding() public {
        ToggleFailUSDC6 usdc = new ToggleFailUSDC6();
        BreadFeeEscrow escrow = new BreadFeeEscrow(address(usdc), address(this));
        escrow.setAuthorizedCreditor(address(this), true);

        uint256 amount = 17 * ONE_USDC;
        usdc.mint(address(this), amount);
        assert(usdc.approve(address(escrow), amount));
        escrow.credit(address(this), amount);
        usdc.setFailTransfers(true);

        (bool ok,) = address(escrow).call(abi.encodeWithSignature("claim()"));

        assert(!ok);
        assert(usdc.balanceOf(address(escrow)) == amount);
        assert(escrow.balanceOf(address(this)) == amount);
        assert(escrow.totalOutstanding() == amount);
    }

    function testSuccessfulClaimCannotReplay() public {
        MockUSDC6 usdc = new MockUSDC6();
        BreadFeeEscrow escrow = new BreadFeeEscrow(address(usdc), address(this));
        escrow.setAuthorizedCreditor(address(this), true);

        uint256 amount = 6 * ONE_USDC;
        usdc.mint(address(this), amount);
        assert(usdc.approve(address(escrow), amount));
        escrow.credit(address(this), amount);
        escrow.claim();

        (bool replayOk,) = address(escrow).call(abi.encodeWithSignature("claim()"));

        assert(!replayOk);
        assert(usdc.balanceOf(address(this)) == amount);
        assert(usdc.balanceOf(address(escrow)) == 0);
        assert(escrow.balanceOf(address(this)) == 0);
        assert(escrow.totalOutstanding() == 0);
    }

    function testClaimDebitsStateBeforeTransferAndBlocksReentry() public {
        ClaimObservingUSDC6 usdc = new ClaimObservingUSDC6();
        BreadFeeEscrow escrow = new BreadFeeEscrow(address(usdc), address(this));
        usdc.setObservedEscrow(escrow);
        usdc.setAttemptReentry(true);
        escrow.setAuthorizedCreditor(address(this), true);

        uint256 amount = 8 * ONE_USDC;
        usdc.mint(address(this), amount);
        assert(usdc.approve(address(escrow), amount));
        escrow.credit(address(usdc), amount);

        uint256 claimed = usdc.claimFromEscrow();

        assert(claimed == amount);
        assert(usdc.observedClaimTransfer());
        assert(usdc.observedRecipientBalance() == 0);
        assert(usdc.observedOutstanding() == 0);
        assert(usdc.reentryBlocked());
        assert(escrow.balanceOf(address(usdc)) == 0);
        assert(escrow.totalOutstanding() == 0);
        assert(usdc.balanceOf(address(escrow)) == 0);
        assert(usdc.balanceOf(address(usdc)) == amount);
    }

    function testFuzz_PartialClaimsPreserveSolvency(uint96 rawCredit, uint96 rawClaim) public {
        MockUSDC6 usdc = new MockUSDC6();
        BreadFeeEscrow escrow = new BreadFeeEscrow(address(usdc), address(this));
        escrow.setAuthorizedCreditor(address(this), true);

        uint256 creditAmount = (uint256(rawCredit) % 1_000_000_000_000) + 1;
        uint256 claimAmount = (uint256(rawClaim) % creditAmount) + 1;
        usdc.mint(address(this), creditAmount);
        assert(usdc.approve(address(escrow), creditAmount));
        escrow.credit(address(this), creditAmount);

        escrow.claim(claimAmount);

        uint256 outstanding = escrow.totalOutstanding();
        assert(escrow.balanceOf(address(this)) == outstanding);
        assert(usdc.balanceOf(address(escrow)) == outstanding);
        assert(usdc.balanceOf(address(escrow)) >= escrow.totalOutstanding());
    }
}
