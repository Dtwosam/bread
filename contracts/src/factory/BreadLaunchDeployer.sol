// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../core/BreadBondingCurve.sol";

contract BreadLaunchDeployer {
    struct BreadLaunchCore {
        address usdc;
        address creatorFeeRecipient;
        address originalDeployer;
        address factory;
        address feePolicy;
        address feeEscrow;
        uint256 phantomQuote;
        uint16 creatorTaxBps;
        uint256 graduationThreshold;
        uint256 supply;
    }

    address public immutable factory;

    constructor(address factory_) {
        factory = factory_;
    }

    function deployCurve(BreadLaunchCore calldata core) external returns (address curve) {
        if (msg.sender != factory) revert();
        curve = address(new BreadBondingCurve(
            core.usdc,
            core.creatorFeeRecipient,
            core.factory,
            core.feePolicy,
            core.feeEscrow,
            core.phantomQuote,
            core.creatorTaxBps,
            core.graduationThreshold
        ));
    }
}
