// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import {BreadPermanentLiquidityLocker} from "../../src/graduation/BreadPermanentLiquidityLocker.sol";
import {BreadV3GraduationAdapter} from "../../src/graduation/BreadV3GraduationAdapter.sol";
import {IGraduationAdapter} from "../../src/interfaces/IGraduationAdapter.sol";

interface ArcForkVm {
    function envString(string calldata name) external returns (string memory value);
    function envAddress(string calldata name) external returns (address value);
    function envUint(string calldata name) external returns (uint256 value);
    function createSelectFork(string calldata urlOrAlias, uint256 blockNumber) external returns (uint256 forkId);
    function prank(address msgSender) external;
}

interface IArcV3FactoryFork {
    function feeAmountTickSpacing(uint24 fee) external view returns (int24);
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
}

interface IArcV3PositionManagerFork {
    function factory() external view returns (address);
    function ownerOf(uint256 tokenId) external view returns (address owner);
}

contract ArcForkLaunchToken is ERC20 {
    constructor() ERC20("Bread Arc Fork Launch", "BAFL") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Day-9 fork-only compatibility proof against the selected Arc Testnet V3 dependencies.
/// @dev No transaction is broadcast to Arc. All token movement and pool creation occurs inside the local fork.
contract ArcV3DependencyForkTest {
    ArcForkVm private constant VM = ArcForkVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant FORK_USDC_AMOUNT = 10_000_000; // 10 USDC at 6 decimals.
    uint256 private constant TOTAL_TOKENS = 20 ether;
    uint256 private constant POOL_TOKENS = 10 ether;

    function testRealArcV3DependencyMintAndPermanentLock() public {
        string memory rpcUrl = VM.envString("ARC_FORK_RPC_URL");
        uint256 forkBlock = VM.envUint("ARC_FORK_BLOCK_NUMBER");
        uint256 expectedChainId = VM.envUint("BREAD_CHAIN_ID");
        address usdc = VM.envAddress("BREAD_USDC");
        address factory = VM.envAddress("BREAD_V3_FACTORY");
        address positionManager = VM.envAddress("BREAD_V3_POSITION_MANAGER");
        address forkUsdcDonor = VM.envAddress("BREAD_FORK_USDC_DONOR");
        uint256 feeValue = VM.envUint("BREAD_V3_FEE");
        require(feeValue <= type(uint24).max, "FEE_OUT_OF_RANGE");
        uint24 fee = uint24(feeValue);

        VM.createSelectFork(rpcUrl, forkBlock);

        require(block.chainid == expectedChainId, "CHAIN_ID_MISMATCH");
        require(usdc.code.length != 0, "USDC_NO_CODE");
        require(factory.code.length != 0, "FACTORY_NO_CODE");
        require(positionManager.code.length != 0, "POSITION_MANAGER_NO_CODE");
        require(IERC20Metadata(usdc).decimals() == 6, "USDC_DECIMALS_MISMATCH");
        require(IArcV3PositionManagerFork(positionManager).factory() == factory, "POSITION_MANAGER_FACTORY_MISMATCH");
        require(IArcV3FactoryFork(factory).feeAmountTickSpacing(fee) > 0, "FEE_TIER_DISABLED");

        ArcForkLaunchToken token = new ArcForkLaunchToken();
        BreadPermanentLiquidityLocker locker = new BreadPermanentLiquidityLocker(address(this));
        locker.setCoordinator(address(this));
        BreadV3GraduationAdapter adapter = new BreadV3GraduationAdapter(
            address(this), usdc, address(locker), positionManager, factory, fee
        );

        require(IERC20(usdc).balanceOf(forkUsdcDonor) >= FORK_USDC_AMOUNT, "FORK_DONOR_USDC_TOO_LOW");
        VM.prank(forkUsdcDonor);
        require(IERC20(usdc).transfer(address(this), FORK_USDC_AMOUNT), "FORK_USDC_TRANSFER_FAILED");

        token.mint(address(this), POOL_TOKENS);
        require(IERC20(usdc).approve(address(adapter), FORK_USDC_AMOUNT), "USDC_APPROVE_FAILED");
        require(token.approve(address(adapter), POOL_TOKENS), "TOKEN_APPROVE_FAILED");

        IGraduationAdapter.Seed memory seed = IGraduationAdapter.Seed({
            token: address(token),
            usdc: usdc,
            usdcAmount: FORK_USDC_AMOUNT,
            totalTokenAmount: TOTAL_TOKENS,
            poolTokenAmount: POOL_TOKENS,
            configHash: adapter.configHash()
        });

        IGraduationAdapter.Result memory result = adapter.execute(seed);
        address pool = IArcV3FactoryFork(factory).getPool(address(token), usdc, fee);

        require(pool != address(0) && pool.code.length != 0, "POOL_NOT_CREATED");
        require(result.poolId == bytes32(uint256(uint160(pool))), "POOL_ID_MISMATCH");
        require(result.positionManager == positionManager, "RESULT_POSITION_MANAGER_MISMATCH");
        require(result.positionId != 0, "POSITION_ID_ZERO");
        require(IArcV3PositionManagerFork(positionManager).ownerOf(result.positionId) == address(locker), "LP_NOT_OWNED_BY_LOCKER");

        require(result.usdcUsed + result.usdcDust == FORK_USDC_AMOUNT, "USDC_RECONCILIATION_FAILED");
        require(result.tokenUsed + result.tokenDust == POOL_TOKENS, "TOKEN_RECONCILIATION_FAILED");
        require(IERC20(usdc).balanceOf(address(adapter)) == 0, "ADAPTER_USDC_RESIDUE");
        require(token.balanceOf(address(adapter)) == 0, "ADAPTER_TOKEN_RESIDUE");
        require(IERC20(usdc).allowance(address(adapter), positionManager) == 0, "USDC_ALLOWANCE_NOT_CLEARED");
        require(token.allowance(address(adapter), positionManager) == 0, "TOKEN_ALLOWANCE_NOT_CLEARED");

        locker.lockPosition(address(token), positionManager, result.positionId);
        require(locker.isPositionLocked(address(token)), "LOCKER_POSITION_NOT_REGISTERED");
        (address lockedManager, uint256 lockedPositionId) = locker.lockedPosition(address(token));
        require(lockedManager == positionManager, "LOCKED_MANAGER_MISMATCH");
        require(lockedPositionId == result.positionId, "LOCKED_POSITION_ID_MISMATCH");
    }
}
