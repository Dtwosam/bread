// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadFeePolicy} from "../src/fees/BreadFeePolicy.sol";
import {BreadFeePolicySnapshot} from "../src/interfaces/IBreadFeePolicy.sol";

contract BreadFeePolicyExternalCaller {
    function setCurrentFeePolicy(BreadFeePolicy policy, BreadFeePolicySnapshot calldata nextPolicy) external {
        policy.setCurrentFeePolicy(nextPolicy);
    }

    function setFeeSweepOperator(BreadFeePolicy policy, address nextOperator) external {
        policy.setFeeSweepOperator(nextOperator);
    }
}

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

    function testOwnerCanUpdateFuturePolicyAndSweepOperator() public {
        BreadFeePolicy policy = new BreadFeePolicy(address(this), _validPolicy(), SWEEP_OPERATOR);
        BreadFeePolicySnapshot memory nextPolicy = BreadFeePolicySnapshot({
            protocolFeeRecipient: address(0xCAFE),
            tradeFeeBps: 125,
            protocolFeeShareBps: 3_000,
            maxCreatorTaxBps: 600
        });
        address nextOperator = address(0xD00D);

        policy.setCurrentFeePolicy(nextPolicy);
        policy.setFeeSweepOperator(nextOperator);

        BreadFeePolicySnapshot memory stored = policy.currentFeePolicy();
        assert(stored.protocolFeeRecipient == nextPolicy.protocolFeeRecipient);
        assert(stored.tradeFeeBps == nextPolicy.tradeFeeBps);
        assert(stored.protocolFeeShareBps == nextPolicy.protocolFeeShareBps);
        assert(stored.maxCreatorTaxBps == nextPolicy.maxCreatorTaxBps);
        assert(policy.feeSweepOperator() == nextOperator);
    }

    function testInvalidFuturePolicyUpdateRevertsAndPreservesCurrentPolicy() public {
        BreadFeePolicy policy = new BreadFeePolicy(address(this), _validPolicy(), SWEEP_OPERATOR);
        BreadFeePolicySnapshot memory invalid = _validPolicy();
        invalid.tradeFeeBps = 1_600;
        invalid.maxCreatorTaxBps = 500;

        (bool ok,) = address(policy).call(
            abi.encodeWithSelector(BreadFeePolicy.setCurrentFeePolicy.selector, invalid)
        );

        assert(!ok);
        BreadFeePolicySnapshot memory stored = policy.currentFeePolicy();
        assert(stored.protocolFeeRecipient == PROTOCOL_RECIPIENT);
        assert(stored.tradeFeeBps == 100);
        assert(stored.protocolFeeShareBps == 2_500);
        assert(stored.maxCreatorTaxBps == 500);
    }

    function testNonOwnerCannotUpdatePolicyOrSweepOperator() public {
        BreadFeePolicy policy = new BreadFeePolicy(address(this), _validPolicy(), SWEEP_OPERATOR);
        BreadFeePolicyExternalCaller outsider = new BreadFeePolicyExternalCaller();
        BreadFeePolicySnapshot memory nextPolicy = BreadFeePolicySnapshot({
            protocolFeeRecipient: address(0xCAFE),
            tradeFeeBps: 125,
            protocolFeeShareBps: 3_000,
            maxCreatorTaxBps: 600
        });

        (bool policyOk,) = address(outsider).call(
            abi.encodeWithSelector(
                BreadFeePolicyExternalCaller.setCurrentFeePolicy.selector,
                policy,
                nextPolicy
            )
        );
        (bool operatorOk,) = address(outsider).call(
            abi.encodeWithSelector(
                BreadFeePolicyExternalCaller.setFeeSweepOperator.selector,
                policy,
                address(0xD00D)
            )
        );

        assert(!policyOk);
        assert(!operatorOk);
        BreadFeePolicySnapshot memory stored = policy.currentFeePolicy();
        assert(stored.protocolFeeRecipient == PROTOCOL_RECIPIENT);
        assert(stored.tradeFeeBps == 100);
        assert(policy.feeSweepOperator() == SWEEP_OPERATOR);
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
