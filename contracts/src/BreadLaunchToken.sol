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

    error ZeroAddress();

    address public immutable deployer;
    address public immutable launchFactory;
    address public immutable curve;

    string public logo;
    string public description;

    Socials private _socials;

    constructor(
        string memory name_,
        string memory symbol_,
        string memory logo_,
        string memory description_,
        Socials memory socials_,
        address deployer_,
        address curve_,
        address launchFactory_,
        uint256 supply_
    ) ERC20(name_, symbol_) {
        if (deployer_ == address(0) || curve_ == address(0) || launchFactory_ == address(0)) {
            revert ZeroAddress();
        }

        deployer = deployer_;
        launchFactory = launchFactory_;
        curve = curve_;
        logo = logo_;
        description = description_;
        _socials = socials_;

        _mint(curve_, supply_);
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
