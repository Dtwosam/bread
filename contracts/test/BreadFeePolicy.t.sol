// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadFeePolicy} from "../src/fees/BreadFeePolicy.sol";
import {BreadFeePolicySnapshot} from "../src/interfaces/IBreadFeePolicy.sol";

contract BreadFeePolicyTest {
    address private constant PROTOCOL_RECIPIENT = address(0xA11CE);
    address private constant SWEEP_OPERATOR = address(0xB0B);

    function testConstructorStoresExplicitFutureLaunchPolicyAndOperator() public {
        BreadFeePolicySnapshot memory initialPolicy = BreadFeePolicySnapshot({
            protocolFeeRecipient: PROTOCOL_RECIPIENT,
            tradeFeeBps: 100,
            protocolFeeShareBps: 2_500,
            maxCreatorTaxBps: 500
        });

        BreadFeePolicy policy = new BreadFeePolicy(address(this), initialPolicy, SWEEP_OPERATOR);
        BreadFeePolicySnapshot memory stored = policy.currentFeePolicy();

        assert(stored.protocolFeeRecipient == PROTOCOL_RECIPIENT);
        assert(stored.tradeFeeBps == 100);
        assert(stored.protocolFeeShareBps == 2_500);
        assert(stored.maxCreatorTaxBps == 500);
        assert(policy.feeSweepOperator() == SWEEP_OPERATOR);
    }
}
