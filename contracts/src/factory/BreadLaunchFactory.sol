// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {BreadBondingCurve} from "../core/BreadBondingCurve.sol";
import {BreadLaunchDeployer} from "./BreadLaunchDeployer.sol";
import {IBreadFeeEscrow} from "../interfaces/IBreadFeeEscrow.sol";
import {IBreadLaunchFactory} from "../interfaces/IBreadLaunchFactory.sol";
import {IBreadFeePolicy, BreadFeePolicySnapshot} from "../interfaces/IBreadFeePolicy.sol";

/// @title BreadLaunchFactory
/// @notice Bread-owned launch orchestration and economics pinning over the accepted Day-3 curve stack.
contract BreadLaunchFactory is Ownable {
    using SafeERC20 for IERC20;

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
    error UnexpectedReceivedAmount(uint256 expected, uint256 actual);
    error ResidualFactoryCustody(uint256 expectedBalance, uint256 actualBalance);

    struct EconomicsDigestInput {
        address usdc;
        uint256 supply;
        uint256 phantomQuote;
        uint256 graduationThreshold;
        address protocolFeeRecipient;
        uint16 tradeFeeBps;
        uint16 protocolFeeShareBps;
        uint16 maxCreatorTaxBps;
        uint256 launchFeeUsdc;
        bytes32 stackVersion;
        uint64 configVersion;
        uint16 startingSnipeTaxBps;
        uint8 snipeDurationSeconds;
        uint16 terminalSnipeTaxBps;
        bytes32 openingProtectionPolicyId;
        bytes32 openingTaxRoutingId;
    }

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
    event LaunchFeeCredited(address indexed token, address indexed protocolRecipient, uint256 amount);
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
        EconomicsDigestInput memory input;
        input.usdc = usdc;
        input.supply = config.supply;
        input.phantomQuote = config.phantomQuote;
        input.graduationThreshold = config.graduationThreshold;
        input.protocolFeeRecipient = policy.protocolFeeRecipient;
        input.tradeFeeBps = policy.tradeFeeBps;
        input.protocolFeeShareBps = policy.protocolFeeShareBps;
        input.maxCreatorTaxBps = policy.maxCreatorTaxBps;
        input.launchFeeUsdc = config.launchFeeUsdc;
        input.stackVersion = stackVersion;
        input.configVersion = configVersion;
        input.startingSnipeTaxBps = STARTING_SNIPE_TAX_BPS;
        input.snipeDurationSeconds = SNIPE_DURATION_SECONDS;
        input.terminalSnipeTaxBps = TERMINAL_SNIPE_TAX_BPS;
        input.openingProtectionPolicyId = OPENING_PROTECTION_POLICY_ID;
        input.openingTaxRoutingId = OPENING_TAX_ROUTING_ID;
        return keccak256(abi.encode(input));
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

        uint256 launchFee = _launchConfig.launchFeeUsdc;
        IERC20 quote = IERC20(usdc);
        uint256 factoryBalanceBefore = quote.balanceOf(address(this));
        _receiveExactLaunchFee(quote, msg.sender, launchFee);

        BreadLaunchDeployer.BreadLaunchDeployment memory deployment = _buildDeployment(params, msg.sender);
        (token, curve) = deployer_.deployLaunch(deployment);
        BreadBondingCurve(curve).initialize(token);
        _creditLaunchFee(quote, token, policy.protocolFeeRecipient, launchFee);
        _recordLaunch(params, token, curve, digest, msg.sender);

        uint256 factoryBalanceAfter = quote.balanceOf(address(this));
        if (factoryBalanceAfter != factoryBalanceBefore) {
            revert ResidualFactoryCustody(factoryBalanceBefore, factoryBalanceAfter);
        }
    }

    function _receiveExactLaunchFee(IERC20 quote, address payer, uint256 amount) private {
        if (amount == 0) return;
        uint256 beforeBalance = quote.balanceOf(address(this));
        quote.safeTransferFrom(payer, address(this), amount);
        uint256 received = quote.balanceOf(address(this)) - beforeBalance;
        if (received != amount) revert UnexpectedReceivedAmount(amount, received);
    }

    function _creditLaunchFee(IERC20 quote, address token, address protocolRecipient, uint256 amount) private {
        if (amount == 0) return;
        quote.forceApprove(feeEscrow, amount);
        IBreadFeeEscrow(feeEscrow).credit(protocolRecipient, amount);
        quote.forceApprove(feeEscrow, 0);
        emit LaunchFeeCredited(token, protocolRecipient, amount);
    }

    function _buildDeployment(IBreadLaunchFactory.LaunchParams calldata params, address originalDeployer)
        private
        view
        returns (BreadLaunchDeployer.BreadLaunchDeployment memory deployment)
    {
        IBreadLaunchFactory.LaunchConfig memory config = _launchConfig;
        deployment.core.usdc = usdc;
        deployment.core.creatorFeeRecipient = params.creatorFeeRecipient;
        deployment.core.originalDeployer = originalDeployer;
        deployment.core.factory = address(this);
        deployment.core.feePolicy = address(feePolicy);
        deployment.core.feeEscrow = feeEscrow;
        deployment.core.phantomQuote = config.phantomQuote;
        deployment.core.creatorTaxBps = params.creatorTaxBps;
        deployment.core.graduationThreshold = config.graduationThreshold;
        deployment.core.supply = config.supply;
        deployment.metadata.name = params.name;
        deployment.metadata.symbol = params.symbol;
        deployment.metadata.logo = params.logo;
        deployment.metadata.description = params.description;
        deployment.metadata.twitter = params.twitter;
        deployment.metadata.telegram = params.telegram;
        deployment.metadata.discord = params.discord;
        deployment.metadata.website = params.website;
        deployment.metadata.farcaster = params.farcaster;
    }

    function _recordLaunch(
        IBreadLaunchFactory.LaunchParams calldata params,
        address token,
        address curve,
        bytes32 digest,
        address originalDeployer
    ) private {
        uint64 launchedAt = uint64(block.timestamp);
        uint64 version = configVersion;
        _launches[token] = IBreadLaunchFactory.LaunchRecord({
            token: token,
            curve: curve,
            deployer: originalDeployer,
            creatorFeeRecipient: params.creatorFeeRecipient,
            creatorTaxBps: params.creatorTaxBps,
            economicsDigest: digest,
            launchTimestamp: launchedAt,
            configVersion: version
        });
        _tokenForCurve[curve] = token;

        emit LaunchCreated(
            originalDeployer,
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
