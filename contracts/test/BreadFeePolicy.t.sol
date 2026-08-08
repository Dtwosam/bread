// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadFeePolicy} from "../src/fees/BreadFeePolicy.sol";
import {BreadFeePolicySnapshot} from "../src/interfaces/IBreadFeePolicy.sol";

contract BreadFeePolicyTest {
    address private constant PROTOCOL_RECIPIENT = address(0xA11CE);
    address private constant SWEEP_OPERATOR = address(0xB0B);

    function testConstructorStoresExplicitFutureLaunchPolicyAndOperator() public {
        BreadFeePolicySnapshot memory initialPolicy = _validPolicy();

        BreadFeePolicy policy = new BreadFeePolicy(address(this), initialPolicy, SWEEP_OPERATOR);
        BreadFeePolicySnapshot memory stored = policy.currentFeePolicy();

        assert(stored.protocolFeeRecipient == PROTOCOL_RECIPIENT);
        assert(stored.tradeFeeBps == 100);
        assert(stored.protocolFeeShareBps == 2_500);
        assert(stored.maxCreatorTaxBps == 500);
        assert(policy.feeSweepOperator() == SWEEP_OPERATOR);
    }

    function testConstructorRejectsZeroProtocolFeeRecipient() public {
        BreadFeePolicySnapshot memory invalid = _validPolicy();
        invalid.protocolFeeRecipient = address(0);
        assert(_constructorReverts(invalid));
    }

    function testConstructorRejectsTradeFeeAtOrAboveHundredPercent() public {
        BreadFeePolicySnapshot memory invalid = _validPolicy();
        invalid.tradeFeeBps = 10_000;
        assert(_constructorReverts(invalid));
    }

    function testConstructorRejectsProtocolShareAboveHundredPercent() public {
        BreadFeePolicySnapshot memory invalid = _validPolicy();
        invalid.protocolFeeShareBps = 10_001;
        assert(_constructorReverts(invalid));
    }

    function testConstructorRejectsCreatorTaxAtOrAboveHundredPercent() public {
        BreadFeePolicySnapshot memory invalid = _validPolicy();
        invalid.maxCreatorTaxBps = 10_000;
        assert(_constructorReverts(invalid));
    }

    function testConstructorRejectsCombinedTradeFeeAndCreatorTaxAboveTwentyPercent() public {
        BreadFeePolicySnapshot memory invalid = _validPolicy();
        invalid.tradeFeeBps = 1_501;
        invalid.maxCreatorTaxBps = 500;
        assert(_constructorReverts(invalid));
    }

    function _validPolicy() private pure returns (BreadFeePolicySnapshot memory policy) {
        return BreadFeePolicySnapshot({
            protocolFeeRecipient: PROTOCOL_RECIPIENT,
            tradeFeeBps: 100,
            protocolFeeShareBps: 2_500,
            maxCreatorTaxBps: 500
        });
    }

    function _constructorReverts(BreadFeePolicySnapshot memory policy) private returns (bool reverted) {
        try new BreadFeePolicy(address(this), policy, SWEEP_OPERATOR) returns (BreadFeePolicy) {
            return false;
        } catch {
            return true;
        }
    }
}
