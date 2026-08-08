// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {BreadBondingCurve} from "../core/BreadBondingCurve.sol";
import {BreadLaunchDeployer} from "./BreadLaunchDeployer.sol";
import {IBreadLaunchFactory} from "../interfaces/IBreadLaunchFactory.sol";
import {IBreadFeePolicy, BreadFeePolicySnapshot} from "../interfaces/IBreadFeePolicy.sol";

/// @title BreadLaunchFactory
/// @notice Bread-owned launch orchestration and economics pinning over the accepted Day-3 curve stack.
contract BreadLaunchFactory is Ownable {
    uint16 public constant STARTING_SNIPE_TAX_BPS = 9_900;
    uint8 public constant SNIPE_DURATION_SECONDS = 5;
    uint16 public constant TERMINAL_SNIPE_TAX_BPS = 0;
    bytes32 public constant OPENING_PROTECTION_POLICY_ID = keccak256("BREAD_QUADRATIC_9900_TO_0_OVER_5_SECONDS_V1");
    bytes32 public constant OPENING_TAX_ROUTING_ID = keccak256("BREAD_QUOTE_FEE_BALANCE_V1");

    error ZeroAddress();
    error InvalidLaunchConfig();
    error EmptyStackVersion();
    error LaunchDeployerAlreadySet();
    error InvalidLaunchDeployer();
    error LaunchDisabled();
    error LaunchDeployerNotSet();
    error CreatorRecipientZeroAddress();
    error EmptyTokenName();
    error EmptyTokenSymbol();
    error CreatorTaxAboveCurrentMaximum(uint16 creatorTaxBps, uint16 maxCreatorTaxBps);
    error StaleEconomics(bytes32 expected, bytes32 actual);

    address public immutable usdc;
    IBreadFeePolicy public immutable feePolicy;
    address public immutable feeEscrow;
    bytes32 public immutable stackVersion;

    BreadLaunchDeployer public launchDeployer;
    uint64 public configVersion;
    IBreadLaunchFactory.LaunchConfig private _launchConfig;
    mapping(address token => IBreadLaunchFactory.LaunchRecord record) private _launches;
    mapping(address curve => address token) private _tokenForCurve;

    event LaunchDeployerSet(address indexed launchDeployer);
    event LaunchConfigUpdated(uint64 indexed previousVersion, uint64 indexed nextVersion);
    event LaunchCreated(
        address indexed deployer,
        address indexed token,
        address indexed curve,
        address creatorFeeRecipient,
        uint16 creatorTaxBps,
        bytes32 economicsDigest,
        uint64 configVersion
    );

    constructor(
        address owner_,
        address usdc_,
        address feePolicy_,
        address feeEscrow_,
        IBreadLaunchFactory.LaunchConfig memory initialConfig_,
        bytes32 stackVersion_
    ) Ownable(owner_) {
        if (usdc_ == address(0) || feePolicy_ == address(0) || feeEscrow_ == address(0)) revert ZeroAddress();
        if (stackVersion_ == bytes32(0)) revert EmptyStackVersion();
        _validateConfig(initialConfig_);

        usdc = usdc_;
        feePolicy = IBreadFeePolicy(feePolicy_);
        feeEscrow = feeEscrow_;
        stackVersion = stackVersion_;
        _launchConfig = initialConfig_;
        configVersion = 1;
    }

    function setLaunchDeployer(BreadLaunchDeployer next) external onlyOwner {
        if (address(launchDeployer) != address(0)) revert LaunchDeployerAlreadySet();
        if (address(next).code.length == 0 || next.factory() != address(this)) revert InvalidLaunchDeployer();
        launchDeployer = next;
        emit LaunchDeployerSet(address(next));
    }

    function setLaunchConfig(IBreadLaunchFactory.LaunchConfig calldata next) external onlyOwner {
        _validateConfig(next);
        uint64 previousVersion = configVersion;
        configVersion = previousVersion + 1;
        _launchConfig = next;
        emit LaunchConfigUpdated(previousVersion, configVersion);
    }

    function currentLaunchConfig()
        external
        view
        returns (IBreadLaunchFactory.LaunchConfig memory config, uint64 version)
    {
        return (_launchConfig, configVersion);
    }

    function previewLaunchEconomics() public view returns (bytes32 digest) {
        IBreadLaunchFactory.LaunchConfig memory config = _launchConfig;
        BreadFeePolicySnapshot memory policy = feePolicy.currentFeePolicy();
        return keccak256(
            abi.encode(
                usdc,
                config.supply,
                config.phantomQuote,
                config.graduationThreshold,
                policy.protocolFeeRecipient,
                policy.tradeFeeBps,
                policy.protocolFeeShareBps,
                policy.maxCreatorTaxBps,
                config.launchFeeUsdc,
                stackVersion,
                configVersion,
                STARTING_SNIPE_TAX_BPS,
                SNIPE_DURATION_SECONDS,
                TERMINAL_SNIPE_TAX_BPS,
                OPENING_PROTECTION_POLICY_ID,
                OPENING_TAX_ROUTING_ID
            )
        );
    }

    function getLaunch(address token) external view returns (IBreadLaunchFactory.LaunchRecord memory record) {
        return _launches[token];
    }

    function tokenForCurve(address curve) external view returns (address token) {
        return _tokenForCurve[curve];
    }

    function launchToken(IBreadLaunchFactory.LaunchParams calldata params)
        external
        returns (address token, address curve)
    {
        if (!_launchConfig.enabled) revert LaunchDisabled();
        BreadLaunchDeployer deployer_ = launchDeployer;
        if (address(deployer_) == address(0)) revert LaunchDeployerNotSet();
        if (params.creatorFeeRecipient == address(0)) revert CreatorRecipientZeroAddress();
        if (bytes(params.name).length == 0) revert EmptyTokenName();
        if (bytes(params.symbol).length == 0) revert EmptyTokenSymbol();

        BreadFeePolicySnapshot memory policy = feePolicy.currentFeePolicy();
        if (params.creatorTaxBps > policy.maxCreatorTaxBps) {
            revert CreatorTaxAboveCurrentMaximum(params.creatorTaxBps, policy.maxCreatorTaxBps);
        }

        bytes32 digest = previewLaunchEconomics();
        if (params.expectedEconomics != bytes32(0) && params.expectedEconomics != digest) {
            revert StaleEconomics(params.expectedEconomics, digest);
        }

        IBreadLaunchFactory.LaunchConfig memory config = _launchConfig;
        BreadLaunchDeployer.BreadLaunchDeployment memory deployment = BreadLaunchDeployer.BreadLaunchDeployment({
            usdc: usdc,
            creatorFeeRecipient: params.creatorFeeRecipient,
            originalDeployer: msg.sender,
            factory: address(this),
            feePolicy: address(feePolicy),
            feeEscrow: feeEscrow,
            phantomQuote: config.phantomQuote,
            creatorTaxBps: params.creatorTaxBps,
            graduationThreshold: config.graduationThreshold,
            supply: config.supply,
            name: params.name,
            symbol: params.symbol,
            logo: params.logo,
            description: params.description,
            twitter: params.twitter,
            telegram: params.telegram,
            discord: params.discord,
            website: params.website,
            farcaster: params.farcaster
        });

        (token, curve) = deployer_.deployLaunch(deployment);
        BreadBondingCurve(curve).initialize(token);

        uint64 launchedAt = uint64(block.timestamp);
        uint64 version = configVersion;
        _launches[token] = IBreadLaunchFactory.LaunchRecord({
            token: token,
            curve: curve,
            deployer: msg.sender,
            creatorFeeRecipient: params.creatorFeeRecipient,
            creatorTaxBps: params.creatorTaxBps,
            economicsDigest: digest,
            launchTimestamp: launchedAt,
            configVersion: version
        });
        _tokenForCurve[curve] = token;

        emit LaunchCreated(
            msg.sender,
            token,
            curve,
            params.creatorFeeRecipient,
            params.creatorTaxBps,
            digest,
            version
        );
    }

    function _validateConfig(IBreadLaunchFactory.LaunchConfig memory config) private pure {
        if (config.supply == 0 || config.phantomQuote == 0 || config.graduationThreshold == 0) {
            revert InvalidLaunchConfig();
        }
    }
}
