// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BreadFeeEscrow} from "../src/fees/BreadFeeEscrow.sol";
import {BreadFeePolicy} from "../src/fees/BreadFeePolicy.sol";
import {BreadLaunchDeployer} from "../src/factory/BreadLaunchDeployer.sol";
import {BreadLaunchFactory} from "../src/factory/BreadLaunchFactory.sol";
import {BreadPermanentLiquidityLocker} from "../src/graduation/BreadPermanentLiquidityLocker.sol";
import {BreadV3GraduationAdapter} from "../src/graduation/BreadV3GraduationAdapter.sol";
import {GraduationCoordinator} from "../src/graduation/GraduationCoordinator.sol";
import {BreadFeePolicySnapshot} from "../src/interfaces/IBreadFeePolicy.sol";
import {IBreadLaunchFactory} from "../src/interfaces/IBreadLaunchFactory.sol";
import {IGraduationCoordinator} from "../src/interfaces/IGraduationCoordinator.sol";
import {BreadEmergencyController} from "../src/security/BreadEmergencyController.sol";

interface BreadDeployVm {
    function envAddress(string calldata name) external returns (address value);
    function envBytes32(string calldata name) external returns (bytes32 value);
    function envUint(string calldata name) external returns (uint256 value);
    function addr(uint256 privateKey) external returns (address keyAddr);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

/// @title DeployDay5Graduation
/// @notice Exact Day-5 stack deployment with no silently defaulted economics or DEX dependencies.
contract DeployDay5Graduation {
    BreadDeployVm private constant VM = BreadDeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    string internal constant BREAD_PRODUCTION_ECONOMICS_CONFIG_REQUIRED =
        "BREAD_PRODUCTION_ECONOMICS_CONFIG_REQUIRED";
    string internal constant ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED = "ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED";

    error InvalidPrivateKeyOwner();
    error MissingRequiredHash(string name);
    error InvalidEconomicsHash(bytes32 expected, bytes32 actual);
    error ValueTooLarge(string name, uint256 value);

    struct Deployment {
        BreadFeePolicy feePolicy;
        BreadFeeEscrow feeEscrow;
        BreadEmergencyController emergencyController;
        BreadLaunchFactory factory;
        BreadLaunchDeployer deployer;
        BreadPermanentLiquidityLocker locker;
        GraduationCoordinator coordinator;
        BreadV3GraduationAdapter adapter;
    }

    struct Inputs {
        address protocolAdmin;
        address guardian;
        address usdc;
        address protocolFeeRecipient;
        address v3PositionManager;
        address v3Factory;
        uint256 supply;
        uint256 phantomQuote;
        uint256 graduationThreshold;
        uint256 launchFeeUsdc;
        uint16 tradeFeeBps;
        uint16 protocolFeeShareBps;
        uint16 maxCreatorTaxBps;
        uint24 v3Fee;
        bytes32 stackVersion;
        bytes32 economicsConfigHash;
        bytes32 dexEvidenceHash;
    }

    function run() external returns (Deployment memory deployment) {
        uint256 privateKey = VM.envUint("BREAD_DEPLOYER_PRIVATE_KEY");
        Inputs memory input = _readInputs();
        if (VM.addr(privateKey) != input.protocolAdmin) revert InvalidPrivateKeyOwner();
        _validateHashes(input);

        VM.startBroadcast(privateKey);
        deployment = _deploy(input);
        VM.stopBroadcast();
    }

    function _readInputs() private returns (Inputs memory input) {
        input.protocolAdmin = VM.envAddress("BREAD_PROTOCOL_ADMIN");
        input.guardian = VM.envAddress("BREAD_GUARDIAN");
        input.usdc = VM.envAddress("BREAD_USDC");
        input.protocolFeeRecipient = VM.envAddress("BREAD_PROTOCOL_FEE_RECIPIENT");
        input.v3PositionManager = VM.envAddress("BREAD_V3_POSITION_MANAGER");
        input.v3Factory = VM.envAddress("BREAD_V3_FACTORY");
        input.supply = VM.envUint("BREAD_SUPPLY");
        input.phantomQuote = VM.envUint("BREAD_PHANTOM_QUOTE");
        input.graduationThreshold = VM.envUint("BREAD_GRADUATION_THRESHOLD");
        input.launchFeeUsdc = VM.envUint("BREAD_LAUNCH_FEE_USDC");
        input.tradeFeeBps = _u16("BREAD_TRADE_FEE_BPS", VM.envUint("BREAD_TRADE_FEE_BPS"));
        input.protocolFeeShareBps =
            _u16("BREAD_PROTOCOL_FEE_SHARE_BPS", VM.envUint("BREAD_PROTOCOL_FEE_SHARE_BPS"));
        input.maxCreatorTaxBps = _u16("BREAD_MAX_CREATOR_TAX_BPS", VM.envUint("BREAD_MAX_CREATOR_TAX_BPS"));
        input.v3Fee = _u24("BREAD_V3_FEE", VM.envUint("BREAD_V3_FEE"));
        input.stackVersion = VM.envBytes32("BREAD_STACK_VERSION");
        input.economicsConfigHash = VM.envBytes32(BREAD_PRODUCTION_ECONOMICS_CONFIG_REQUIRED);
        input.dexEvidenceHash = VM.envBytes32(ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED);
    }

    function _validateHashes(Inputs memory input) private pure {
        if (input.stackVersion == bytes32(0)) revert MissingRequiredHash("BREAD_STACK_VERSION");
        if (input.economicsConfigHash == bytes32(0)) {
            revert MissingRequiredHash(BREAD_PRODUCTION_ECONOMICS_CONFIG_REQUIRED);
        }
        if (input.dexEvidenceHash == bytes32(0)) revert MissingRequiredHash(ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED);

        bytes32 actualEconomicsHash = keccak256(
            abi.encode(
                input.usdc,
                input.supply,
                input.phantomQuote,
                input.graduationThreshold,
                input.launchFeeUsdc,
                input.protocolFeeRecipient,
                input.tradeFeeBps,
                input.protocolFeeShareBps,
                input.maxCreatorTaxBps,
                input.stackVersion
            )
        );
        if (actualEconomicsHash != input.economicsConfigHash) {
            revert InvalidEconomicsHash(input.economicsConfigHash, actualEconomicsHash);
        }
    }

    function _deploy(Inputs memory input) private returns (Deployment memory d) {
        BreadFeePolicySnapshot memory policy = BreadFeePolicySnapshot({
            protocolFeeRecipient: input.protocolFeeRecipient,
            tradeFeeBps: input.tradeFeeBps,
            protocolFeeShareBps: input.protocolFeeShareBps,
            maxCreatorTaxBps: input.maxCreatorTaxBps
        });
        d.feePolicy = new BreadFeePolicy(input.protocolAdmin, policy, input.protocolAdmin);
        d.feeEscrow = new BreadFeeEscrow(input.usdc, input.protocolAdmin);
        d.emergencyController = new BreadEmergencyController(input.protocolAdmin, input.guardian);

        IBreadLaunchFactory.LaunchConfig memory config = IBreadLaunchFactory.LaunchConfig({
            supply: input.supply,
            phantomQuote: input.phantomQuote,
            graduationThreshold: input.graduationThreshold,
            launchFeeUsdc: input.launchFeeUsdc,
            graduationAdapter: address(0),
            graduationConfigHash: bytes32(0),
            enabled: false
        });
        d.factory = new BreadLaunchFactory(
            input.protocolAdmin,
            input.usdc,
            address(d.feePolicy),
            address(d.feeEscrow),
            address(d.emergencyController),
            config,
            input.stackVersion
        );
        d.deployer = new BreadLaunchDeployer(address(d.factory));
        d.locker = new BreadPermanentLiquidityLocker(input.protocolAdmin);
        d.coordinator = new GraduationCoordinator(
            input.protocolAdmin,
            address(d.factory),
            input.usdc,
            address(d.feeEscrow),
            address(d.emergencyController),
            d.locker
        );

        d.locker.setCoordinator(address(d.coordinator));
        d.adapter = new BreadV3GraduationAdapter(
            address(d.coordinator),
            input.usdc,
            address(d.locker),
            input.v3PositionManager,
            input.v3Factory,
            input.v3Fee
        );
        d.factory.setGraduationCoordinator(IGraduationCoordinator(address(d.coordinator)));
        d.factory.setLaunchDeployer(d.deployer);
        d.feeEscrow.setAuthorizedCreditor(address(d.coordinator), true);

        config.graduationAdapter = address(d.adapter);
        config.graduationConfigHash = d.adapter.configHash();
        config.enabled = true;
        d.factory.setLaunchConfig(config);
    }

    function _u16(string memory name, uint256 value) private pure returns (uint16 result) {
        if (value > type(uint16).max) revert ValueTooLarge(name, value);
        return uint16(value);
    }

    function _u24(string memory name, uint256 value) private pure returns (uint24 result) {
        if (value > type(uint24).max) revert ValueTooLarge(name, value);
        return uint24(value);
    }
}
