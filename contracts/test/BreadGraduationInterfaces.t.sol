// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IGraduationAdapter} from "../src/interfaces/IGraduationAdapter.sol";
import {IGraduationCoordinator} from "../src/interfaces/IGraduationCoordinator.sol";

contract BreadGraduationInterfacesTest {
    function testFrozenInterfaceShapesCompile() public pure {
        IGraduationAdapter.AdapterFamily family = IGraduationAdapter.AdapterFamily.UNISWAP_V4;
        IGraduationCoordinator.GraduationPhase phase = IGraduationCoordinator.GraduationPhase.SWEPT;

        assert(uint8(family) == 1);
        assert(uint8(phase) == 1);
    }

    function testAdapterResultCarriesPositionManagerIdentity() public pure {
        IGraduationAdapter.Result memory result = IGraduationAdapter.Result({
            poolId: bytes32(uint256(1)),
            positionManager: address(0x1234),
            positionId: 7,
            usdcUsed: 1,
            tokenUsed: 2,
            usdcDust: 3,
            tokenDust: 4
        });

        assert(result.positionManager == address(0x1234));
        assert(result.positionId == 7);
    }
}
