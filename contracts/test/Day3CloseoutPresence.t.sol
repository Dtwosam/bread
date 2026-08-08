// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../src/core/BreadBondingCurve.sol";
import {BreadFeeEscrow} from "../src/fees/BreadFeeEscrow.sol";
import {BreadFeePolicy} from "../src/fees/BreadFeePolicy.sol";
import {IBreadFeeEscrow} from "../src/interfaces/IBreadFeeEscrow.sol";
import {IBreadFeePolicy} from "../src/interfaces/IBreadFeePolicy.sol";

contract Day3CloseoutPresenceTest {
    function testDay3ProductionSurfaceIsPresentOnIntegrationBaseline() public pure {
        assert(type(BreadBondingCurve).creationCode.length != 0);
        assert(type(BreadFeeEscrow).creationCode.length != 0);
        assert(type(BreadFeePolicy).creationCode.length != 0);
        assert(type(IBreadFeeEscrow).interfaceId != bytes4(0));
        assert(type(IBreadFeePolicy).interfaceId != bytes4(0));
    }
}
