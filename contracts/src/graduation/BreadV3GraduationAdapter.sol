// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IGraduationAdapter} from "../interfaces/IGraduationAdapter.sol";

/// @dev Bread-local minimal ABI derived from the pinned official Uniswap V3 interface shape.
interface IBreadV3FactoryLike {
    function feeAmountTickSpacing(uint24 fee) external view returns (int24);
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
}

/// @dev Bread-local minimal ABI derived from the pinned official Uniswap V3 periphery interface shape.
interface IBreadV3PositionManagerLike {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    function factory() external view returns (address);

    function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96)
        external
        payable
        returns (address pool);

    function mint(MintParams calldata params)
        external
        payable
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
}

/// @dev Bread-local read-only ABI used to reject an already initialized pool at the wrong opening price.
interface IBreadV3PoolLike {
    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        );
}

/// @title BreadV3GraduationAdapter
/// @notice Inactive-by-default Uniswap V3 fallback behind Bread's DEX-neutral graduation boundary.
/// @dev Network activation is controlled by manifests/source evidence, not by the existence of this contract.
contract BreadV3GraduationAdapter is IGraduationAdapter {
    using SafeERC20 for IERC20;

    bytes32 public constant CONFIG_DOMAIN = keccak256("BREAD_V3_GRADUATION_ADAPTER_V1");
    int24 public constant MIN_TICK = -887272;
    int24 public constant MAX_TICK = 887272;
    uint160 public constant MIN_SQRT_RATIO = 4295128739;
    uint160 public constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

    error ZeroAddress();
    error InvalidDependency();
    error InvalidFeeTier();
    error InvalidSeed();
    error WrongConfigHash();
    error NotCoordinator();
    error PoolPriceMismatch();
    error PoolIdentityMismatch();
    error InvalidMintResult();
    error UnexpectedTransferAmount();

    struct SeedPlan {
        address token0;
        address token1;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint160 sqrtPriceX96;
    }

    struct BalanceCheckpoint {
        uint256 quoteBefore;
        uint256 tokenBefore;
    }

    struct MintReceipt {
        address pool;
        uint256 positionId;
        uint256 amount0;
        uint256 amount1;
    }

    address public immutable coordinator;
    address public immutable override usdc;
    address public immutable override locker;
    address public immutable positionManager;
    address public immutable v3Factory;
    uint24 public immutable fee;
    int24 public immutable tickSpacing;
    int24 public immutable tickLower;
    int24 public immutable tickUpper;
    bytes32 public immutable override configHash;

    constructor(
        address coordinator_,
        address usdc_,
        address locker_,
        address positionManager_,
        address v3Factory_,
        uint24 fee_
    ) {
        if (
            coordinator_ == address(0) || usdc_ == address(0) || locker_ == address(0)
                || positionManager_ == address(0) || v3Factory_ == address(0)
        ) revert ZeroAddress();
        if (
            coordinator_.code.length == 0 || usdc_.code.length == 0 || locker_.code.length == 0
                || positionManager_.code.length == 0 || v3Factory_.code.length == 0
        ) revert InvalidDependency();
        if (IBreadV3PositionManagerLike(positionManager_).factory() != v3Factory_) revert InvalidDependency();

        int24 spacing = IBreadV3FactoryLike(v3Factory_).feeAmountTickSpacing(fee_);
        if (spacing <= 0) revert InvalidFeeTier();
        int24 lower = (MIN_TICK / spacing) * spacing;
        int24 upper = (MAX_TICK / spacing) * spacing;

        coordinator = coordinator_;
        usdc = usdc_;
        locker = locker_;
        positionManager = positionManager_;
        v3Factory = v3Factory_;
        fee = fee_;
        tickSpacing = spacing;
        tickLower = lower;
        tickUpper = upper;
        configHash = keccak256(
            abi.encode(
                CONFIG_DOMAIN,
                coordinator_,
                usdc_,
                locker_,
                positionManager_,
                v3Factory_,
                fee_,
                spacing,
                lower,
                upper
            )
        );
    }

    function family() external pure override returns (AdapterFamily) {
        return AdapterFamily.UNISWAP_V3;
    }

    function validateSeed(Seed calldata seed) external view override {
        _validateSeed(seed);
    }

    function execute(Seed calldata seed) external override returns (Result memory result) {
        if (msg.sender != coordinator) revert NotCoordinator();
        SeedPlan memory plan = _validateSeed(seed);
        BalanceCheckpoint memory checkpoint = _pullExact(seed);
        MintReceipt memory receipt = _createAndMint(plan);
        return _reconcileAndReturn(seed, plan, checkpoint, receipt);
    }

    function _pullExact(Seed calldata seed) private returns (BalanceCheckpoint memory checkpoint) {
        IERC20 quote = IERC20(usdc);
        IERC20 launchToken = IERC20(seed.token);
        checkpoint.quoteBefore = quote.balanceOf(address(this));
        checkpoint.tokenBefore = launchToken.balanceOf(address(this));

        quote.safeTransferFrom(msg.sender, address(this), seed.usdcAmount);
        launchToken.safeTransferFrom(msg.sender, address(this), seed.poolTokenAmount);
        if (
            quote.balanceOf(address(this)) - checkpoint.quoteBefore != seed.usdcAmount
                || launchToken.balanceOf(address(this)) - checkpoint.tokenBefore != seed.poolTokenAmount
        ) revert UnexpectedTransferAmount();
    }

    function _createAndMint(SeedPlan memory plan) private returns (MintReceipt memory receipt) {
        receipt.pool = IBreadV3PositionManagerLike(positionManager).createAndInitializePoolIfNecessary(
            plan.token0, plan.token1, fee, plan.sqrtPriceX96
        );
        if (
            receipt.pool == address(0) || receipt.pool.code.length == 0
                || IBreadV3FactoryLike(v3Factory).getPool(plan.token0, plan.token1, fee) != receipt.pool
        ) revert PoolIdentityMismatch();
        if (_poolSqrtPrice(receipt.pool) != plan.sqrtPriceX96) revert PoolPriceMismatch();

        IERC20(plan.token0).forceApprove(positionManager, plan.amount0Desired);
        IERC20(plan.token1).forceApprove(positionManager, plan.amount1Desired);
        uint128 liquidity;
        (receipt.positionId, liquidity, receipt.amount0, receipt.amount1) =
            IBreadV3PositionManagerLike(positionManager).mint(_mintParams(plan));
        IERC20(plan.token0).forceApprove(positionManager, 0);
        IERC20(plan.token1).forceApprove(positionManager, 0);

        if (
            liquidity == 0 || receipt.amount0 > plan.amount0Desired || receipt.amount1 > plan.amount1Desired
        ) revert InvalidMintResult();
    }

    function _mintParams(SeedPlan memory plan)
        private
        view
        returns (IBreadV3PositionManagerLike.MintParams memory params)
    {
        params = IBreadV3PositionManagerLike.MintParams({
            token0: plan.token0,
            token1: plan.token1,
            fee: fee,
            tickLower: tickLower,
            tickUpper: tickUpper,
            amount0Desired: plan.amount0Desired,
            amount1Desired: plan.amount1Desired,
            amount0Min: 0,
            amount1Min: 0,
            recipient: locker,
            deadline: block.timestamp
        });
    }

    function _reconcileAndReturn(
        Seed calldata seed,
        SeedPlan memory plan,
        BalanceCheckpoint memory checkpoint,
        MintReceipt memory receipt
    ) private returns (Result memory result) {
        uint256 amount0Dust = plan.amount0Desired - receipt.amount0;
        uint256 amount1Dust = plan.amount1Desired - receipt.amount1;
        if (amount0Dust != 0) IERC20(plan.token0).safeTransfer(msg.sender, amount0Dust);
        if (amount1Dust != 0) IERC20(plan.token1).safeTransfer(msg.sender, amount1Dust);

        if (
            IERC20(usdc).balanceOf(address(this)) != checkpoint.quoteBefore
                || IERC20(seed.token).balanceOf(address(this)) != checkpoint.tokenBefore
        ) revert UnexpectedTransferAmount();

        bool quoteIsToken0 = plan.token0 == usdc;
        result = Result({
            poolId: bytes32(uint256(uint160(receipt.pool))),
            positionManager: positionManager,
            positionId: receipt.positionId,
            usdcUsed: quoteIsToken0 ? receipt.amount0 : receipt.amount1,
            tokenUsed: quoteIsToken0 ? receipt.amount1 : receipt.amount0,
            usdcDust: quoteIsToken0 ? amount0Dust : amount1Dust,
            tokenDust: quoteIsToken0 ? amount1Dust : amount0Dust
        });
    }

    function _validateSeed(Seed calldata seed) private view returns (SeedPlan memory plan) {
        if (seed.configHash != configHash) revert WrongConfigHash();
        if (
            seed.token == address(0) || seed.token == usdc || seed.token.code.length == 0 || seed.usdc != usdc
                || seed.usdcAmount == 0 || seed.totalTokenAmount == 0 || seed.poolTokenAmount == 0
                || seed.poolTokenAmount > seed.totalTokenAmount
        ) revert InvalidSeed();
        if (
            positionManager.code.length == 0 || v3Factory.code.length == 0
                || IBreadV3PositionManagerLike(positionManager).factory() != v3Factory
                || IBreadV3FactoryLike(v3Factory).feeAmountTickSpacing(fee) != tickSpacing
        ) revert InvalidDependency();

        if (seed.token < usdc) {
            plan.token0 = seed.token;
            plan.token1 = usdc;
            plan.amount0Desired = seed.poolTokenAmount;
            plan.amount1Desired = seed.usdcAmount;
        } else {
            plan.token0 = usdc;
            plan.token1 = seed.token;
            plan.amount0Desired = seed.usdcAmount;
            plan.amount1Desired = seed.poolTokenAmount;
        }

        plan.sqrtPriceX96 = _sqrtPriceX96(plan.amount0Desired, plan.amount1Desired);
        address existingPool = IBreadV3FactoryLike(v3Factory).getPool(plan.token0, plan.token1, fee);
        if (existingPool != address(0)) {
            if (existingPool.code.length == 0) revert PoolIdentityMismatch();
            if (_poolSqrtPrice(existingPool) != plan.sqrtPriceX96) revert PoolPriceMismatch();
        }
    }

    function _sqrtPriceX96(uint256 amount0, uint256 amount1) private pure returns (uint160 sqrtPriceX96) {
        if (amount0 == 0 || amount1 == 0) revert InvalidSeed();
        uint256 ratioX128 = Math.mulDiv(amount1, uint256(1) << 128, amount0);
        if (ratioX128 == 0) revert InvalidSeed();

        uint256 sqrtPriceX64 = Math.sqrt(ratioX128);
        if (sqrtPriceX64 > type(uint128).max) revert InvalidSeed();
        sqrtPriceX96 = uint160(sqrtPriceX64 << 32);
        if (sqrtPriceX96 <= MIN_SQRT_RATIO || sqrtPriceX96 >= MAX_SQRT_RATIO) revert InvalidSeed();
    }

    function _poolSqrtPrice(address pool) private view returns (uint160 sqrtPriceX96) {
        (sqrtPriceX96,,,,,,) = IBreadV3PoolLike(pool).slot0();
    }
}
