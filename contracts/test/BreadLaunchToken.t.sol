// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadLaunchToken} from "../src/BreadLaunchToken.sol";

contract BreadLaunchTokenSpender {
    function transferFrom(BreadLaunchToken token, address from, address to, uint256 amount)
        external
        returns (bool)
    {
        return token.transferFrom(from, to, amount);
    }

    function burnFrom(BreadLaunchToken token, address account, uint256 amount) external {
        token.burnFrom(account, amount);
    }
}

contract BreadLaunchTokenTest {
    address private constant DEPLOYER = address(0xD3E0);
    address private constant FACTORY = address(0xFAC7);
    address private constant RECIPIENT = address(0xBEEF);
    uint256 private constant SUPPLY = 1_000_000_000 ether;

    function testMintsEntireSupplyOnlyToCurve() public {
        BreadLaunchToken token = _deploy(DEPLOYER, address(this), FACTORY, SUPPLY);
        assert(token.totalSupply() == SUPPLY);
        assert(token.balanceOf(address(this)) == SUPPLY);
        assert(token.balanceOf(DEPLOYER) == 0);
        assert(token.balanceOf(FACTORY) == 0);
    }

    function testStoresImmutableAttributionAddresses() public {
        BreadLaunchToken token = _deploy(DEPLOYER, address(this), FACTORY, SUPPLY);
        assert(token.deployer() == DEPLOYER);
        assert(token.curve() == address(this));
        assert(token.launchFactory() == FACTORY);
    }

    function testMetadataAndSocialsRoundTrip() public {
        BreadLaunchToken token = _deploy(DEPLOYER, address(this), FACTORY, SUPPLY);
        assert(_eq(token.name(), "Bread Test"));
        assert(_eq(token.symbol(), "BREADT"));
        assert(_eq(token.logo(), "ipfs://logo"));
        assert(_eq(token.description(), "Bread source-faithful token"));
        assert(token.decimals() == 18);

        (string memory twitter, string memory telegram, string memory discord, string memory website, string memory farcaster) =
            token.socials();
        assert(_eq(twitter, "https://x.com/bread"));
        assert(_eq(telegram, "https://t.me/bread"));
        assert(_eq(discord, "https://discord.gg/bread"));
        assert(_eq(website, "https://bread.example"));
        assert(_eq(farcaster, "https://warpcast.com/bread"));
    }

    function testGetTokenInfoRoundTripsConstructorData() public {
        BreadLaunchToken token = _deploy(DEPLOYER, address(this), FACTORY, SUPPLY);
        (
            address tokenDeployer,
            string memory tokenLogo,
            string memory tokenDescription,
            BreadLaunchToken.Socials memory tokenSocials
        ) = token.getTokenInfo();

        assert(tokenDeployer == DEPLOYER);
        assert(_eq(tokenLogo, "ipfs://logo"));
        assert(_eq(tokenDescription, "Bread source-faithful token"));
        assert(_eq(tokenSocials.twitter, "https://x.com/bread"));
        assert(_eq(tokenSocials.telegram, "https://t.me/bread"));
        assert(_eq(tokenSocials.discord, "https://discord.gg/bread"));
        assert(_eq(tokenSocials.website, "https://bread.example"));
        assert(_eq(tokenSocials.farcaster, "https://warpcast.com/bread"));
    }

    function testRevertsWhenDeployerIsZero() public {
        _assertConstructorZeroAddressRevert(address(0), address(this), FACTORY);
    }

    function testRevertsWhenCurveIsZero() public {
        _assertConstructorZeroAddressRevert(DEPLOYER, address(0), FACTORY);
    }

    function testRevertsWhenLaunchFactoryIsZero() public {
        _assertConstructorZeroAddressRevert(DEPLOYER, address(this), address(0));
    }

    function testStandardTransferAndAllowanceBehavior() public {
        BreadLaunchToken token = _deploy(DEPLOYER, address(this), FACTORY, SUPPLY);
        BreadLaunchTokenSpender spender = new BreadLaunchTokenSpender();

        assert(token.transfer(RECIPIENT, 100 ether));
        assert(token.balanceOf(RECIPIENT) == 100 ether);
        assert(token.balanceOf(address(this)) == SUPPLY - 100 ether);

        assert(token.approve(address(spender), 50 ether));
        assert(token.allowance(address(this), address(spender)) == 50 ether);
        assert(spender.transferFrom(token, address(this), RECIPIENT, 20 ether));
        assert(token.allowance(address(this), address(spender)) == 30 ether);
        assert(token.balanceOf(RECIPIENT) == 120 ether);
    }

    function testHolderBurnReducesBalanceAndTotalSupply() public {
        BreadLaunchToken token = _deploy(DEPLOYER, address(this), FACTORY, SUPPLY);
        token.burn(10 ether);
        assert(token.balanceOf(address(this)) == SUPPLY - 10 ether);
        assert(token.totalSupply() == SUPPLY - 10 ether);
    }

    function testBurnFromConsumesAllowanceAndReducesSupply() public {
        BreadLaunchToken token = _deploy(DEPLOYER, address(this), FACTORY, SUPPLY);
        BreadLaunchTokenSpender spender = new BreadLaunchTokenSpender();
        assert(token.approve(address(spender), 25 ether));
        spender.burnFrom(token, address(this), 10 ether);
        assert(token.allowance(address(this), address(spender)) == 15 ether);
        assert(token.balanceOf(address(this)) == SUPPLY - 10 ether);
        assert(token.totalSupply() == SUPPLY - 10 ether);
    }

    function testNoPublicMintPrivilegeExists() public {
        BreadLaunchToken token = _deploy(DEPLOYER, address(this), FACTORY, SUPPLY);
        uint256 beforeSupply = token.totalSupply();
        (bool mintOk,) = address(token).call(
            abi.encodeWithSelector(bytes4(keccak256("mint(address,uint256)")), DEPLOYER, 1 ether)
        );
        (bool ownerOk,) = address(token).staticcall(abi.encodeWithSelector(bytes4(keccak256("owner()"))));
        assert(!mintOk);
        assert(!ownerOk);
        assert(token.totalSupply() == beforeSupply);
    }

    function testFuzz_InitialSupplyAlwaysBelongsToCurve(uint128 supplySeed) public {
        uint256 supply = uint256(supplySeed) + 1;
        BreadLaunchToken token = _deploy(DEPLOYER, address(this), FACTORY, supply);
        assert(token.totalSupply() == supply);
        assert(token.balanceOf(address(this)) == supply);
        assert(token.balanceOf(DEPLOYER) == 0);
    }

    function _deploy(address deployer_, address curve_, address factory_, uint256 supply_)
        private
        returns (BreadLaunchToken)
    {
        BreadLaunchToken.Socials memory socialValues = BreadLaunchToken.Socials({
            twitter: "https://x.com/bread",
            telegram: "https://t.me/bread",
            discord: "https://discord.gg/bread",
            website: "https://bread.example",
            farcaster: "https://warpcast.com/bread"
        });
        return new BreadLaunchToken(
            "Bread Test",
            "BREADT",
            "ipfs://logo",
            "Bread source-faithful token",
            socialValues,
            deployer_,
            curve_,
            factory_,
            supply_
        );
    }

    function _assertConstructorZeroAddressRevert(address deployer_, address curve_, address factory_) private {
        BreadLaunchToken.Socials memory socialValues = BreadLaunchToken.Socials({
            twitter: "",
            telegram: "",
            discord: "",
            website: "",
            farcaster: ""
        });
        try new BreadLaunchToken(
            "Bread Test",
            "BREADT",
            "",
            "",
            socialValues,
            deployer_,
            curve_,
            factory_,
            1
        ) returns (BreadLaunchToken) {
            assert(false);
        } catch (bytes memory data) {
            assert(data.length >= 4);
            bytes4 actualSelector;
            assembly ("memory-safe") {
                actualSelector := mload(add(data, 0x20))
            }
            assert(actualSelector == BreadLaunchToken.ZeroAddress.selector);
        }
    }

    function _eq(string memory a, string memory b) private pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}
