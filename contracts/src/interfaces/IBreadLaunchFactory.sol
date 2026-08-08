// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IBreadLaunchFactory {
    struct LaunchConfig {
        uint256 supply;
        uint256 phantomQuote;
        uint256 graduationThreshold;
        uint256 launchFeeUsdc;
        bool enabled;
    }

    struct LaunchParams {
        string name;
        string symbol;
        string logo;
        string description;
        string twitter;
        string telegram;
        string discord;
        string website;
        string farcaster;
        address creatorFeeRecipient;
        uint16 creatorTaxBps;
        bytes32 expectedEconomics;
    }

    struct LaunchRecord {
        address token;
        address curve;
        address deployer;
        address creatorFeeRecipient;
        uint16 creatorTaxBps;
        bytes32 economicsDigest;
        uint64 launchTimestamp;
        uint64 configVersion;
    }

    function previewLaunchEconomics() external view returns (bytes32 digest);
    function currentLaunchConfig() external view returns (LaunchConfig memory config, uint64 version);
    function getLaunch(address token) external view returns (LaunchRecord memory record);
    function tokenForCurve(address curve) external view returns (address token);
    function launchToken(LaunchParams calldata params) external returns (address token, address curve);
    function launchTokenAndBuy(
        LaunchParams calldata params,
        uint256 quoteIn,
        uint256 minTokensOut,
        address recipient
    ) external returns (address token, address curve, uint256 tokensOut);
}
