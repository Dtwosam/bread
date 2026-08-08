// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadBondingCurve} from "../src/core/BreadBondingCurve.sol";
import {BreadLaunchToken} from "../src/BreadLaunchToken.sol";
import {BreadFeeEscrow} from "../src/fees/BreadFeeEscrow.sol";
import {BreadFeePolicy} from "../src/fees/BreadFeePolicy.sol";
import {BreadLaunchFactory} from "../src/factory/BreadLaunchFactory.sol";
import {BreadLaunchDeployer} from "../src/factory/BreadLaunchDeployer.sol";
import {IBreadLaunchFactory} from "../src/interfaces/IBreadLaunchFactory.sol";
import {BreadFeePolicySnapshot} from "../src/interfaces/IBreadFeePolicy.sol";
import {MockUSDC6} from "./helpers/MockUSDC6.sol";
import {BreadAlwaysOpenEmergencyController} from "./helpers/BreadEmergencyTestHelpers.sol";
import {BreadDay5TestWiring} from "./helpers/BreadDay5TestWiring.sol";

contract BreadLaunchFactoryTest {
    uint256 private constant ONE_USDC = 1_000_000;
    uint256 private constant SUPPLY = 1_000_000 ether;
    uint256 private constant PHANTOM_QUOTE = 10_000 * ONE_USDC;
    uint256 private constant GRADUATION_THRESHOLD = 100_000 * ONE_USDC;
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

    function testLaunchRecordsPinnedEconomicsAndCanonicalPair() public {
        Fixture memory f = _deployFixture(true);
        bytes32 expected = f.factory.previewLaunchEconomics();
        IBreadLaunchFactory.LaunchParams memory p = _params(expected);

        (address token, address curve) = f.factory.launchToken(p);
        IBreadLaunchFactory.LaunchRecord memory record = f.factory.getLaunch(token);
        (IBreadLaunchFactory.LaunchConfig memory config, uint64 version) = f.factory.currentLaunchConfig();

        assert(record.token == token);
        assert(record.curve == curve);
        assert(record.deployer == address(this));
        assert(record.creatorFeeRecipient == CREATOR_RECIPIENT);
        assert(record.creatorTaxBps == CREATOR_TAX_BPS);
        assert(record.economicsDigest == expected);
        assert(record.configVersion == version);
        assert(record.launchTimestamp == BreadBondingCurve(curve).launchTimestamp());
        assert(f.factory.tokenForCurve(curve) == token);
        assert(BreadBondingCurve(curve).pairToken() == address(f.usdc));
        assert(BreadBondingCurve(curve).token() == token);
        assert(BreadLaunchToken(token).balanceOf(curve) == config.supply);
        assert(BreadLaunchToken(token).totalSupply() == config.supply);
    }

    function testDisabledLaunchRejectsWithoutCreatingRecord() public {
        Fixture memory f = _deployFixture(false);
        IBreadLaunchFactory.LaunchParams memory p = _params(bytes32(0));
        (bool ok,) = address(f.factory).call(abi.encodeWithSelector(BreadLaunchFactory.launchToken.selector, p));
        assert(!ok);
    }

    function testStaleEconomicsDigestRejectsAfterConfigChange() public {
        Fixture memory f = _deployFixture(true);
        bytes32 stale = f.factory.previewLaunchEconomics();
        (IBreadLaunchFactory.LaunchConfig memory config,) = f.factory.currentLaunchConfig();
        config.phantomQuote += ONE_USDC;
        f.factory.setLaunchConfig(config);
        IBreadLaunchFactory.LaunchParams memory p = _params(stale);

        (bool ok,) = address(f.factory).call(abi.encodeWithSelector(BreadLaunchFactory.launchToken.selector, p));

        assert(!ok);
        assert(f.factory.previewLaunchEconomics() != stale);
    }

    function testEconomicsDigestChangesWithFeePolicyButOldLaunchRecordDoesNot() public {
        Fixture memory f = _deployFixture(true);
        bytes32 firstDigest = f.factory.previewLaunchEconomics();
        IBreadLaunchFactory.LaunchParams memory p = _params(firstDigest);
        (address token,) = f.factory.launchToken(p);
        IBreadLaunchFactory.LaunchRecord memory beforeRecord = f.factory.getLaunch(token);

        f.policy.setCurrentFeePolicy(
            BreadFeePolicySnapshot({
                protocolFeeRecipient: address(0xBEEF),
                tradeFeeBps: 150,
                protocolFeeShareBps: 3_000,
                maxCreatorTaxBps: 450
            })
        );

        bytes32 nextDigest = f.factory.previewLaunchEconomics();
        IBreadLaunchFactory.LaunchRecord memory afterRecord = f.factory.getLaunch(token);
        assert(nextDigest != firstDigest);
        assert(afterRecord.economicsDigest == beforeRecord.economicsDigest);
        assert(afterRecord.curve == beforeRecord.curve);
        assert(afterRecord.creatorTaxBps == beforeRecord.creatorTaxBps);
        assert(afterRecord.launchTimestamp == beforeRecord.launchTimestamp);
    }

    function testMetadataAboveFrozenNameLimitRejects() public {
        Fixture memory f = _deployFixture(true);
        IBreadLaunchFactory.LaunchParams memory p = _params(f.factory.previewLaunchEconomics());
        p.name = _repeat("N", 65);
        (bool ok,) = address(f.factory).call(abi.encodeWithSelector(BreadLaunchFactory.launchToken.selector, p));
        assert(!ok);
    }

    function testMetadataAtFrozenLimitsLaunches() public {
        Fixture memory f = _deployFixture(true);
        IBreadLaunchFactory.LaunchParams memory p = _params(f.factory.previewLaunchEconomics());
        p.name = _repeat("N", 64);
        p.symbol = _repeat("S", 16);
        p.logo = _repeat("L", 512);
        p.description = _repeat("D", 2048);
        p.twitter = _repeat("T", 256);
        p.telegram = _repeat("G", 256);
        p.discord = _repeat("C", 256);
        p.website = _repeat("W", 256);
        p.farcaster = _repeat("F", 256);

        (address token, address curve) = f.factory.launchToken(p);
        assert(token != address(0));
        assert(curve != address(0));
    }

    function testDeployerRejectsDirectNonFactoryDeployment() public {
        Fixture memory f = _deployFixture(true);
        BreadLaunchDeployer.BreadLaunchDeployment memory p;
        p.core.usdc = address(f.usdc);
        p.core.creatorFeeRecipient = CREATOR_RECIPIENT;
        p.core.originalDeployer = address(this);
        p.core.factory = address(f.factory);
        p.core.feePolicy = address(f.policy);
        p.core.feeEscrow = address(f.escrow);
        p.core.emergencyController = address(f.factory.emergencyController());
        p.core.phantomQuote = PHANTOM_QUOTE;
        p.core.creatorTaxBps = CREATOR_TAX_BPS;
        p.core.graduationThreshold = GRADUATION_THRESHOLD;
        p.core.supply = SUPPLY;
        p.metadata.name = "Direct";
        p.metadata.symbol = "DIR";

        (bool ok,) = address(f.deployer).call(abi.encodeWithSelector(BreadLaunchDeployer.deployLaunch.selector, p));
        assert(!ok);
    }

    function testZeroCreatorRecipientAndEmptyIdentityReject() public {
        Fixture memory f = _deployFixture(true);
        bytes32 expected = f.factory.previewLaunchEconomics();
        IBreadLaunchFactory.LaunchParams memory zeroCreator = _params(expected);
        zeroCreator.creatorFeeRecipient = address(0);
        IBreadLaunchFactory.LaunchParams memory emptyName = _params(expected);
        emptyName.name = "";
        IBreadLaunchFactory.LaunchParams memory emptySymbol = _params(expected);
        emptySymbol.symbol = "";

        (bool zeroOk,) = address(f.factory).call(abi.encodeWithSelector(BreadLaunchFactory.launchToken.selector, zeroCreator));
        (bool nameOk,) = address(f.factory).call(abi.encodeWithSelector(BreadLaunchFactory.launchToken.selector, emptyName));
        (bool symbolOk,) = address(f.factory).call(abi.encodeWithSelector(BreadLaunchFactory.launchToken.selector, emptySymbol));
        assert(!zeroOk);
        assert(!nameOk);
        assert(!symbolOk);
    }

    function _deployFixture(bool enabled) private returns (Fixture memory f) {
        f.usdc = new MockUSDC6();
        BreadFeePolicySnapshot memory snapshot = BreadFeePolicySnapshot({
            protocolFeeRecipient: PROTOCOL_RECIPIENT,
            tradeFeeBps: TRADE_FEE_BPS,
            protocolFeeShareBps: PROTOCOL_SHARE_BPS,
            maxCreatorTaxBps: MAX_CREATOR_TAX_BPS
        });
        f.policy = new BreadFeePolicy(address(this), snapshot, address(0xB0B));
        f.escrow = new BreadFeeEscrow(address(f.usdc), address(this));
        BreadAlwaysOpenEmergencyController emergencyController = new BreadAlwaysOpenEmergencyController();
        IBreadLaunchFactory.LaunchConfig memory config = IBreadLaunchFactory.LaunchConfig({
            supply: SUPPLY,
            phantomQuote: PHANTOM_QUOTE,
            graduationThreshold: GRADUATION_THRESHOLD,
            launchFeeUsdc: 0,
            graduationAdapter: address(0),
            graduationConfigHash: bytes32(0),
            enabled: false
        });
        f.factory = new BreadLaunchFactory(
            address(this), address(f.usdc), address(f.policy), address(f.escrow), address(emergencyController), config, STACK_VERSION
        );
        f.deployer = new BreadLaunchDeployer(address(f.factory));
        f.factory.setLaunchDeployer(f.deployer);
        if (enabled) {
            BreadDay5TestWiring.wire(f.factory, f.usdc, f.escrow, address(emergencyController));
        }
    }

    function _params(bytes32 expectedEconomics)
        private
        pure
        returns (IBreadLaunchFactory.LaunchParams memory p)
    {
        p.name = "Bread Test";
        p.symbol = "BREAD";
        p.logo = "logo";
        p.description = "description";
        p.twitter = "twitter";
        p.telegram = "telegram";
        p.discord = "discord";
        p.website = "website";
        p.farcaster = "farcaster";
        p.creatorFeeRecipient = CREATOR_RECIPIENT;
        p.creatorTaxBps = CREATOR_TAX_BPS;
        p.expectedEconomics = expectedEconomics;
    }

    function _repeat(string memory value, uint256 count) private pure returns (string memory) {
        bytes memory unit = bytes(value);
        bytes memory out = new bytes(unit.length * count);
        for (uint256 i; i < count; ++i) {
            for (uint256 j; j < unit.length; ++j) {
                out[i * unit.length + j] = unit[j];
            }
        }
        return string(out);
    }
}
