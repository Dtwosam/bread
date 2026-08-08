// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../core/BreadBondingCurve.sol";
import {BreadLaunchToken} from "../BreadLaunchToken.sol";

contract BreadLaunchDeployer {
    uint256 public constant MAX_NAME_BYTES = 64;
    uint256 public constant MAX_SYMBOL_BYTES = 16;
    uint256 public constant MAX_LOGO_BYTES = 512;
    uint256 public constant MAX_DESCRIPTION_BYTES = 2_048;
    uint256 public constant MAX_SOCIAL_BYTES = 256;

    error ZeroAddress();
    error NotFactory();
    error MetadataTooLong();

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
        if (factory_ == address(0)) revert ZeroAddress();
        factory = factory_;
    }

    function deployLaunch(BreadLaunchDeployment calldata p) external returns (address token, address curve) {
        if (msg.sender != factory) revert NotFactory();
        _validateMetadata(p.metadata);

        BreadLaunchCore calldata core = p.core;
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

        BreadLaunchMetadata calldata metadata = p.metadata;
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
            curve,
            core.factory,
            core.supply
        ));
    }

    function _validateMetadata(BreadLaunchMetadata calldata metadata) private pure {
        if (
            bytes(metadata.name).length > MAX_NAME_BYTES || bytes(metadata.symbol).length > MAX_SYMBOL_BYTES
                || bytes(metadata.logo).length > MAX_LOGO_BYTES
                || bytes(metadata.description).length > MAX_DESCRIPTION_BYTES
                || bytes(metadata.twitter).length > MAX_SOCIAL_BYTES
                || bytes(metadata.telegram).length > MAX_SOCIAL_BYTES
                || bytes(metadata.discord).length > MAX_SOCIAL_BYTES
                || bytes(metadata.website).length > MAX_SOCIAL_BYTES
                || bytes(metadata.farcaster).length > MAX_SOCIAL_BYTES
        ) revert MetadataTooLong();
    }
}
