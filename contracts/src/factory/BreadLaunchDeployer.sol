// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

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

    struct BreadLaunchMetadata {
        string name;
        string symbol;
        string logo;
        string description;
        string twitter;
        string telegram;
        string discord;
        string website;
        string farcaster;
    }

    struct BreadLaunchDeployment {
        BreadLaunchCore core;
        BreadLaunchMetadata metadata;
    }

    address public immutable factory;

    constructor(address factory_) {
        factory = factory_;
    }

    function deployLaunch(BreadLaunchDeployment calldata p) external view returns (address token, address curve) {
        if (msg.sender != factory) revert();
        if (p.core.supply == 0 || bytes(p.metadata.name).length == 0) revert();
        token = p.core.originalDeployer;
        curve = p.core.factory;
    }
}
