// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../core/BreadBondingCurve.sol";
import {BreadLaunchToken} from "../BreadLaunchToken.sol";

/// @title BreadLaunchDeployer
/// @notice Factory-only helper that deploys a Bread curve/token pair without owning launch economics.
contract BreadLaunchDeployer {
    uint256 public constant MAX_NAME_BYTES = 64;
    uint256 public constant MAX_SYMBOL_BYTES = 16;
    uint256 public constant MAX_LOGO_BYTES = 512;
    uint256 public constant MAX_DESCRIPTION_BYTES = 2_048;
    uint256 public constant MAX_SOCIAL_BYTES = 256;

    error ZeroAddress();
    error NotFactory();
    error MetadataTooLong();

    struct BreadLaunchDeployment {
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
        if (factory_ == address(0)) revert ZeroAddress();
        factory = factory_;
    }

    function deployLaunch(BreadLaunchDeployment calldata p)
        external
        returns (address token, address curve)
    {
        if (msg.sender != factory) revert NotFactory();
        _validateMetadata(p);

        curve = address(
            new BreadBondingCurve(
                p.usdc,
                p.creatorFeeRecipient,
                p.factory,
                p.feePolicy,
                p.feeEscrow,
                p.phantomQuote,
                p.creatorTaxBps,
                p.graduationThreshold
            )
        );

        BreadLaunchToken.Socials memory socials = BreadLaunchToken.Socials({
            twitter: p.twitter,
            telegram: p.telegram,
            discord: p.discord,
            website: p.website,
            farcaster: p.farcaster
        });

        token = address(
            new BreadLaunchToken(
                p.name,
                p.symbol,
                p.logo,
                p.description,
                socials,
                p.originalDeployer,
                curve,
                p.factory,
                p.supply
            )
        );
    }

    function _validateMetadata(BreadLaunchDeployment calldata p) private pure {
        if (
            bytes(p.name).length > MAX_NAME_BYTES || bytes(p.symbol).length > MAX_SYMBOL_BYTES
                || bytes(p.logo).length > MAX_LOGO_BYTES || bytes(p.description).length > MAX_DESCRIPTION_BYTES
                || bytes(p.twitter).length > MAX_SOCIAL_BYTES || bytes(p.telegram).length > MAX_SOCIAL_BYTES
                || bytes(p.discord).length > MAX_SOCIAL_BYTES || bytes(p.website).length > MAX_SOCIAL_BYTES
                || bytes(p.farcaster).length > MAX_SOCIAL_BYTES
        ) revert MetadataTooLong();
    }
}
