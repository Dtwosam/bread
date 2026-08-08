// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/// @title BreadLaunchToken
/// @notice Fixed-supply Bread launch token ported from the frozen Pons V2 launcher-token behavior.
contract BreadLaunchToken is ERC20, ERC20Burnable {
    struct Socials {
        string twitter;
        string telegram;
        string discord;
        string website;
        string farcaster;
    }

    /// @dev Constructor transport only. Runtime metadata semantics are unchanged.
    struct Metadata {
        string name;
        string symbol;
        string logo;
        string description;
        Socials socials;
    }

    /// @dev Constructor transport only. Runtime attribution and fixed-supply semantics are unchanged.
    struct LaunchContext {
        address deployer;
        address curve;
        address launchFactory;
        uint256 supply;
    }

    error ZeroAddress();

    address public immutable deployer;
    address public immutable launchFactory;
    address public immutable curve;

    string public logo;
    string public description;

    Socials private _socials;

    constructor(Metadata memory metadata_, LaunchContext memory context_)
        ERC20(metadata_.name, metadata_.symbol)
    {
        if (
            context_.deployer == address(0) || context_.curve == address(0)
                || context_.launchFactory == address(0)
        ) {
            revert ZeroAddress();
        }

        deployer = context_.deployer;
        launchFactory = context_.launchFactory;
        curve = context_.curve;
        logo = metadata_.logo;
        description = metadata_.description;
        _socials = metadata_.socials;

        _mint(context_.curve, context_.supply);
    }

    function socials()
        external
        view
        returns (
            string memory twitter,
            string memory telegram,
            string memory discord,
            string memory website,
            string memory farcaster
        )
    {
        Socials memory values = _socials;
        return (values.twitter, values.telegram, values.discord, values.website, values.farcaster);
    }

    function getTokenInfo()
        external
        view
        returns (
            address tokenDeployer,
            string memory tokenLogo,
            string memory tokenDescription,
            Socials memory tokenSocials
        )
    {
        return (deployer, logo, description, _socials);
    }
}
