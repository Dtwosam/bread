// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadLaunchToken} from "../BreadLaunchToken.sol";

contract BreadLaunchDeployer {
    struct BreadTokenCore {
        address originalDeployer;
        address curve;
        address factory;
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

    address public immutable factory;

    constructor(address factory_) {
        factory = factory_;
    }

    function deployToken(BreadTokenCore calldata core, BreadLaunchMetadata calldata metadata)
        external
        returns (address token)
    {
        if (msg.sender != factory) revert();

        BreadLaunchToken.Socials memory socials = BreadLaunchToken.Socials({
            twitter: metadata.twitter,
            telegram: metadata.telegram,
            discord: metadata.discord,
            website: metadata.website,
            farcaster: metadata.farcaster
        });

        token = address(new BreadLaunchToken(
            metadata.name,
            metadata.symbol,
            metadata.logo,
            metadata.description,
            socials,
            core.originalDeployer,
            core.curve,
            core.factory,
            core.supply
        ));
    }
}
