// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface Day9SafeVm {
    function envAddress(string calldata name) external returns (address value);
    function envUint(string calldata name) external returns (uint256 value);
    function addr(uint256 privateKey) external returns (address keyAddr);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

interface IDay9SafeSetup {
    function setup(
        address[] calldata owners,
        uint256 threshold,
        address to,
        bytes calldata data,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address payable paymentReceiver
    ) external;
}

interface IDay9SafeProxyFactory {
    function createChainSpecificProxyWithNonce(address singleton, bytes calldata initializer, uint256 saltNonce)
        external
        returns (address payable proxy);
}

interface IDay9SafeView {
    function VERSION() external view returns (string memory);
    function getThreshold() external view returns (uint256);
    function getOwners() external view returns (address[] memory);
}

/// @notice Day-9 Arc Testnet rehearsal-only creation of a genuine 2-of-3 Safe v1.4.1 proxy.
/// @dev Owner private keys are never consumed by this script. The deployment key is separate
///      from the Safe owners and Guardian and is used only to pay for the proxy-creation tx.
contract CreateDay9ArcSafe {
    Day9SafeVm private constant VM = Day9SafeVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant ARC_TESTNET_CHAIN_ID = 5_042_002;
    address private constant SAFE_L2 = 0x29fcB43b46531BcA003ddC8FCB67FFE91900C762;
    address private constant SAFE_PROXY_FACTORY = 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67;

    error WrongChain(uint256 actual);
    error DeploymentAuthorityMismatch();
    error MissingSafeCore();
    error InvalidAuthoritySet();
    error SafeVerificationFailed();

    function run() external returns (address safe) {
        if (block.chainid != ARC_TESTNET_CHAIN_ID) revert WrongChain(block.chainid);
        if (SAFE_L2.code.length == 0 || SAFE_PROXY_FACTORY.code.length == 0) revert MissingSafeCore();

        uint256 deploymentKey = VM.envUint("BREAD_DEPLOYER_PRIVATE_KEY");
        address deploymentAuthority = VM.envAddress("BREAD_DEPLOYMENT_AUTHORITY");
        address guardian = VM.envAddress("BREAD_GUARDIAN");
        address owner1 = VM.envAddress("BREAD_SAFE_OWNER_1");
        address owner2 = VM.envAddress("BREAD_SAFE_OWNER_2");
        address owner3 = VM.envAddress("BREAD_SAFE_OWNER_3");
        uint256 saltNonce = VM.envUint("BREAD_DAY9_SAFE_SALT_NONCE");

        if (VM.addr(deploymentKey) != deploymentAuthority) revert DeploymentAuthorityMismatch();
        _validateAuthorities(deploymentAuthority, guardian, owner1, owner2, owner3);

        address[] memory owners = new address[](3);
        owners[0] = owner1;
        owners[1] = owner2;
        owners[2] = owner3;

        bytes memory initializer = abi.encodeCall(
            IDay9SafeSetup.setup,
            (owners, 2, address(0), bytes(""), address(0), address(0), 0, payable(address(0)))
        );

        VM.startBroadcast(deploymentKey);
        safe = IDay9SafeProxyFactory(SAFE_PROXY_FACTORY).createChainSpecificProxyWithNonce(
            SAFE_L2, initializer, saltNonce
        );
        VM.stopBroadcast();

        _verifySafe(safe, owner1, owner2, owner3);
    }

    function _validateAuthorities(
        address deploymentAuthority,
        address guardian,
        address owner1,
        address owner2,
        address owner3
    ) private pure {
        if (
            deploymentAuthority == address(0) || guardian == address(0) || owner1 == address(0) || owner2 == address(0)
                || owner3 == address(0)
        ) revert InvalidAuthoritySet();
        if (deploymentAuthority == guardian) revert InvalidAuthoritySet();
        if (owner1 == owner2 || owner1 == owner3 || owner2 == owner3) revert InvalidAuthoritySet();
        if (deploymentAuthority == owner1 || deploymentAuthority == owner2 || deploymentAuthority == owner3) {
            revert InvalidAuthoritySet();
        }
        if (guardian == owner1 || guardian == owner2 || guardian == owner3) revert InvalidAuthoritySet();
    }

    function _verifySafe(address safe, address owner1, address owner2, address owner3) private view {
        if (safe == address(0) || safe.code.length == 0) revert SafeVerificationFailed();
        IDay9SafeView viewSafe = IDay9SafeView(safe);
        if (viewSafe.getThreshold() != 2) revert SafeVerificationFailed();
        if (keccak256(bytes(viewSafe.VERSION())) != keccak256(bytes("1.4.1"))) revert SafeVerificationFailed();

        address[] memory actualOwners = viewSafe.getOwners();
        if (actualOwners.length != 3) revert SafeVerificationFailed();
        bool seen1;
        bool seen2;
        bool seen3;
        for (uint256 i = 0; i < actualOwners.length; ++i) {
            if (actualOwners[i] == owner1) seen1 = true;
            else if (actualOwners[i] == owner2) seen2 = true;
            else if (actualOwners[i] == owner3) seen3 = true;
            else revert SafeVerificationFailed();
        }
        if (!(seen1 && seen2 && seen3)) revert SafeVerificationFailed();
    }
}
