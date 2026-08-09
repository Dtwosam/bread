// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadFeeEscrow} from "../src/fees/BreadFeeEscrow.sol";
import {BreadFeePolicy} from "../src/fees/BreadFeePolicy.sol";
import {BreadLaunchFactory} from "../src/factory/BreadLaunchFactory.sol";
import {BreadLaunchDeployer} from "../src/factory/BreadLaunchDeployer.sol";
import {IBreadLaunchFactory} from "../src/interfaces/IBreadLaunchFactory.sol";
import {BreadFeePolicySnapshot} from "../src/interfaces/IBreadFeePolicy.sol";
import {MockUSDC6} from "./helpers/MockUSDC6.sol";
import {ShortTransferUSDC6} from "./helpers/BreadFeeEscrowAdversaries.sol";
import {BreadAlwaysOpenEmergencyController} from "./helpers/BreadEmergencyTestHelpers.sol";
import {BreadDay5TestWiring} from "./helpers/BreadDay5TestWiring.sol";

contract BreadLaunchFeeTest {
    uint256 private constant ONE_USDC = 1_000_000;
    uint256 private constant SUPPLY = 1_000_000 ether;
    uint256 private constant PHANTOM_QUOTE = 10_000 * ONE_USDC;
    uint256 private constant GRADUATION_THRESHOLD = 100_000 * ONE_USDC;
    uint256 private constant LAUNCH_FEE = 10 * ONE_USDC;
    uint16 private constant TRADE_FEE_BPS = 100;
    uint16 private constant PROTOCOL_SHARE_BPS = 2_500;
    uint16 private constant MAX_CREATOR_TAX_BPS = 500;
    uint16 private constant CREATOR_TAX_BPS = 400;
    bytes32 private constant STACK_VERSION = keccak256("BREAD_DAY4_STACK_V1");

    address private constant PROTOCOL_RECIPIENT = address(0xA11CE);
    address private constant CREATOR_RECIPIENT = address(0xC0DE);

    struct Fixture {
        MockUSDC6 usdc;
        BreadFeePolicy policy;
        BreadFeeEscrow escrow;
        BreadLaunchFactory factory;
        BreadLaunchDeployer deployer;
    }

    function testNonZeroLaunchFeeCreditsProtocolRecipientAndLeavesNoFactoryCustody() public {
        Fixture memory f = _deployFixture(LAUNCH_FEE);
        f.escrow.setAuthorizedCreditor(address(f.factory), true);
        f.usdc.mint(address(this), LAUNCH_FEE);
        assert(f.usdc.approve(address(f.factory), LAUNCH_FEE));

        uint256 factoryBalanceBefore = f.usdc.balanceOf(address(f.factory));
        uint256 escrowBalanceBefore = f.usdc.balanceOf(address(f.escrow));
        (address token,) = f.factory.launchToken(_params(f.factory.previewLaunchEconomics()));

        assert(token != address(0));
        assert(f.usdc.balanceOf(address(this)) == 0);
        assert(f.usdc.balanceOf(address(f.factory)) == factoryBalanceBefore);
        assert(f.usdc.balanceOf(address(f.escrow)) == escrowBalanceBefore + LAUNCH_FEE);
        assert(f.escrow.balanceOf(PROTOCOL_RECIPIENT) == LAUNCH_FEE);
        assert(f.escrow.totalOutstanding() == LAUNCH_FEE);
    }

    function testZeroLaunchFeeTakesNoUsdcAndNeedsNoFactoryCreditAuthorization() public {
        Fixture memory f = _deployFixture(0);
        uint256 userBefore = f.usdc.balanceOf(address(this));
        uint256 factoryBefore = f.usdc.balanceOf(address(f.factory));
        uint256 escrowBefore = f.usdc.balanceOf(address(f.escrow));

        (address token,) = f.factory.launchToken(_params(f.factory.previewLaunchEconomics()));

        assert(token != address(0));
        assert(f.usdc.balanceOf(address(this)) == userBefore);
        assert(f.usdc.balanceOf(address(f.factory)) == factoryBefore);
        assert(f.usdc.balanceOf(address(f.escrow)) == escrowBefore);
        assert(f.escrow.totalOutstanding() == 0);
    }

    function testNonZeroLaunchFeeRequiresFactoryToBeAuthorizedCreditorAndRollsBackLaunch() public {
        Fixture memory f = _deployFixture(LAUNCH_FEE);
        f.usdc.mint(address(this), LAUNCH_FEE);
        assert(f.usdc.approve(address(f.factory), LAUNCH_FEE));
        bytes32 expected = f.factory.previewLaunchEconomics();

        (bool ok,) = address(f.factory).call(
            abi.encodeWithSelector(BreadLaunchFactory.launchToken.selector, _params(expected))
        );

        assert(!ok);
        assert(f.usdc.balanceOf(address(this)) == LAUNCH_FEE);
        assert(f.usdc.balanceOf(address(f.factory)) == 0);
        assert(f.usdc.balanceOf(address(f.escrow)) == 0);
        assert(f.escrow.totalOutstanding() == 0);
    }

    function testLaunchFeeInsufficientAllowanceRollsBackBeforeDurableLaunch() public {
        Fixture memory f = _deployFixture(LAUNCH_FEE);
        f.escrow.setAuthorizedCreditor(address(f.factory), true);
        f.usdc.mint(address(this), LAUNCH_FEE);
        assert(f.usdc.approve(address(f.factory), LAUNCH_FEE - 1));

        (bool ok,) = address(f.factory).call(
            abi.encodeWithSelector(
                BreadLaunchFactory.launchToken.selector,
                _params(f.factory.previewLaunchEconomics())
            )
        );

        assert(!ok);
        assert(f.usdc.balanceOf(address(this)) == LAUNCH_FEE);
        assert(f.usdc.balanceOf(address(f.factory)) == 0);
        assert(f.usdc.balanceOf(address(f.escrow)) == 0);
        assert(f.escrow.totalOutstanding() == 0);
    }

    function testShortTransferLaunchFeeCannotCreateUnderfundedProtocolCredit() public {
        ShortTransferUSDC6 usdc = new ShortTransferUSDC6();
        BreadFeePolicySnapshot memory snapshot = _policySnapshot();
        BreadFeePolicy policy = new BreadFeePolicy(address(this), snapshot, address(0xB0B));
        BreadFeeEscrow escrow = new BreadFeeEscrow(address(usdc), address(this));
        BreadLaunchFactory factory = _deployFactory(address(usdc), policy, escrow, LAUNCH_FEE);
        escrow.setAuthorizedCreditor(address(factory), true);

        usdc.mint(address(this), LAUNCH_FEE);
        assert(usdc.approve(address(factory), LAUNCH_FEE));

        (bool ok,) = address(factory).call(
            abi.encodeWithSelector(
                BreadLaunchFactory.launchToken.selector,
                _params(factory.previewLaunchEconomics())
            )
        );

        assert(!ok);
        assert(usdc.balanceOf(address(this)) == LAUNCH_FEE);
        assert(usdc.balanceOf(address(factory)) == 0);
        assert(usdc.balanceOf(address(escrow)) == 0);
        assert(escrow.balanceOf(PROTOCOL_RECIPIENT) == 0);
        assert(escrow.totalOutstanding() == 0);
    }

    function testLaunchFeeUsesCurrentPinnedProtocolRecipient() public {
        Fixture memory f = _deployFixture(LAUNCH_FEE);
        address nextProtocolRecipient = address(0xBEEF);
        f.policy.setCurrentFeePolicy(
            BreadFeePolicySnapshot({
                protocolFeeRecipient: nextProtocolRecipient,
                tradeFeeBps: TRADE_FEE_BPS,
                protocolFeeShareBps: PROTOCOL_SHARE_BPS,
                maxCreatorTaxBps: MAX_CREATOR_TAX_BPS
            })
        );
        f.escrow.setAuthorizedCreditor(address(f.factory), true);
        f.usdc.mint(address(this), LAUNCH_FEE);
        assert(f.usdc.approve(address(f.factory), LAUNCH_FEE));
        bytes32 expected = f.factory.previewLaunchEconomics();

        f.factory.launchToken(_params(expected));

        assert(f.escrow.balanceOf(PROTOCOL_RECIPIENT) == 0);
        assert(f.escrow.balanceOf(nextProtocolRecipient) == LAUNCH_FEE);
        assert(f.escrow.totalOutstanding() == LAUNCH_FEE);
    }

    function _deployFixture(uint256 launchFee) private returns (Fixture memory f) {
        f.usdc = new MockUSDC6();
        BreadFeePolicySnapshot memory snapshot = _policySnapshot();
        f.policy = new BreadFeePolicy(address(this), snapshot, address(0xB0B));
        f.escrow = new BreadFeeEscrow(address(f.usdc), address(this));
        f.factory = _deployFactory(address(f.usdc), f.policy, f.escrow, launchFee);
        f.deployer = f.factory.launchDeployer();
    }

    function _deployFactory(address usdc, BreadFeePolicy policy, BreadFeeEscrow escrow, uint256 launchFee)
        private
        returns (BreadLaunchFactory factory)
    {
        IBreadLaunchFactory.LaunchConfig memory config = IBreadLaunchFactory.LaunchConfig({
            supply: SUPPLY,
            phantomQuote: PHANTOM_QUOTE,
            graduationThreshold: GRADUATION_THRESHOLD,
            launchFeeUsdc: launchFee,
            graduationAdapter: address(0),
            graduationConfigHash: bytes32(0),
            enabled: false
        });
        BreadAlwaysOpenEmergencyController emergencyController = new BreadAlwaysOpenEmergencyController();
        factory = new BreadLaunchFactory(
            address(this), usdc, address(policy), address(escrow), address(emergencyController), config, STACK_VERSION
        );
        BreadLaunchDeployer deployer = new BreadLaunchDeployer(address(factory));
        factory.setLaunchDeployer(deployer);
        BreadDay5TestWiring.wire(factory, usdc, escrow, address(emergencyController));
    }

    function _policySnapshot() private pure returns (BreadFeePolicySnapshot memory snapshot) {
        snapshot = BreadFeePolicySnapshot({
            protocolFeeRecipient: PROTOCOL_RECIPIENT,
            tradeFeeBps: TRADE_FEE_BPS,
            protocolFeeShareBps: PROTOCOL_SHARE_BPS,
            maxCreatorTaxBps: MAX_CREATOR_TAX_BPS
        });
    }

    function _params(bytes32 expectedEconomics)
        private
        pure
        returns (IBreadLaunchFactory.LaunchParams memory p)
    {
        p.name = "Bread Fee Test";
        p.symbol = "BFEE";
        p.logo = "";
        p.description = "";
        p.twitter = "";
        p.telegram = "";
        p.discord = "";
        p.website = "";
        p.farcaster = "";
        p.creatorFeeRecipient = CREATOR_RECIPIENT;
        p.creatorTaxBps = CREATOR_TAX_BPS;
        p.expectedEconomics = expectedEconomics;
    }
}
