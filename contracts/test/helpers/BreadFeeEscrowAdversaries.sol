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

contract ShortTransferUSDC6 is ERC20 {
    constructor() ERC20("Short Transfer USDC", "stUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        _spendAllowance(from, msg.sender, amount);
        uint256 delivered = amount == 0 ? 0 : amount - 1;
        _transfer(from, to, delivered);
        return true;
    }
}

contract ClaimObservingUSDC6 is ERC20 {
    BreadFeeEscrow public observedEscrow;
    uint256 public observedRecipientBalance;
    uint256 public observedOutstanding;
    bool public observedClaimTransfer;
    bool public attemptReentry;
    bool public reentryBlocked;

    constructor() ERC20("Claim Observing USDC", "coUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setObservedEscrow(BreadFeeEscrow escrow_) external {
        observedEscrow = escrow_;
    }

    function setAttemptReentry(bool enabled) external {
        attemptReentry = enabled;
    }

    function claimFromEscrow() external returns (uint256 amount) {
        return observedEscrow.claim();
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        BreadFeeEscrow escrow = observedEscrow;
        if (address(escrow) != address(0) && msg.sender == address(escrow)) {
            observedClaimTransfer = true;
            observedRecipientBalance = escrow.balanceOf(to);
            observedOutstanding = escrow.totalOutstanding();

            if (attemptReentry) {
                try escrow.claim() returns (uint256) {
                    reentryBlocked = false;
                } catch {
                    reentryBlocked = true;
                }
            }
        }

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
