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

        coordinator = coordinator_;
        usdc = usdc_;
        locker = locker_;
        positionManager = positionManager_;
        v3Factory = v3Factory_;
        fee = fee_;
        tickSpacing = spacing;
        tickLower = (MIN_TICK / spacing) * spacing;
        tickUpper = (MAX_TICK / spacing) * spacing;
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
                tickLower,
                tickUpper
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
        (address token0, address token1, uint256 amount0Desired, uint256 amount1Desired, uint160 sqrtPriceX96) =
            _validateSeed(seed);

        IERC20 quote = IERC20(usdc);
        IERC20 launchToken = IERC20(seed.token);
        uint256 quoteBefore = quote.balanceOf(address(this));
        uint256 tokenBefore = launchToken.balanceOf(address(this));

        quote.safeTransferFrom(msg.sender, address(this), seed.usdcAmount);
        launchToken.safeTransferFrom(msg.sender, address(this), seed.poolTokenAmount);
        if (
            quote.balanceOf(address(this)) - quoteBefore != seed.usdcAmount
                || launchToken.balanceOf(address(this)) - tokenBefore != seed.poolTokenAmount
        ) revert UnexpectedTransferAmount();

        address pool = IBreadV3PositionManagerLike(positionManager).createAndInitializePoolIfNecessary(
            token0, token1, fee, sqrtPriceX96
        );
        if (
            pool == address(0) || pool.code.length == 0
                || IBreadV3FactoryLike(v3Factory).getPool(token0, token1, fee) != pool
        ) revert PoolIdentityMismatch();
        if (_poolSqrtPrice(pool) != sqrtPriceX96) revert PoolPriceMismatch();

        IERC20(token0).forceApprove(positionManager, amount0Desired);
        IERC20(token1).forceApprove(positionManager, amount1Desired);
        (uint256 positionId, uint128 liquidity, uint256 amount0, uint256 amount1) =
            IBreadV3PositionManagerLike(positionManager).mint(
                IBreadV3PositionManagerLike.MintParams({
                    token0: token0,
                    token1: token1,
                    fee: fee,
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    amount0Desired: amount0Desired,
                    amount1Desired: amount1Desired,
                    amount0Min: 0,
                    amount1Min: 0,
                    recipient: locker,
                    deadline: block.timestamp
                })
            );
        IERC20(token0).forceApprove(positionManager, 0);
        IERC20(token1).forceApprove(positionManager, 0);

        if (liquidity == 0 || amount0 > amount0Desired || amount1 > amount1Desired) revert InvalidMintResult();

        uint256 amount0Dust = amount0Desired - amount0;
        uint256 amount1Dust = amount1Desired - amount1;
        if (amount0Dust != 0) IERC20(token0).safeTransfer(msg.sender, amount0Dust);
        if (amount1Dust != 0) IERC20(token1).safeTransfer(msg.sender, amount1Dust);

        if (quote.balanceOf(address(this)) != quoteBefore || launchToken.balanceOf(address(this)) != tokenBefore) {
            revert UnexpectedTransferAmount();
        }

        bool quoteIsToken0 = token0 == usdc;
        result = Result({
            poolId: bytes32(uint256(uint160(pool))),
            positionManager: positionManager,
            positionId: positionId,
            usdcUsed: quoteIsToken0 ? amount0 : amount1,
            tokenUsed: quoteIsToken0 ? amount1 : amount0,
            usdcDust: quoteIsToken0 ? amount0Dust : amount1Dust,
            tokenDust: quoteIsToken0 ? amount1Dust : amount0Dust
        });
    }

    function _validateSeed(Seed calldata seed)
        private
        view
        returns (
            address token0,
            address token1,
            uint256 amount0Desired,
            uint256 amount1Desired,
            uint160 sqrtPriceX96
        )
    {
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
            token0 = seed.token;
            token1 = usdc;
            amount0Desired = seed.poolTokenAmount;
            amount1Desired = seed.usdcAmount;
        } else {
            token0 = usdc;
            token1 = seed.token;
            amount0Desired = seed.usdcAmount;
            amount1Desired = seed.poolTokenAmount;
        }

        sqrtPriceX96 = _sqrtPriceX96(amount0Desired, amount1Desired);
        address existingPool = IBreadV3FactoryLike(v3Factory).getPool(token0, token1, fee);
        if (existingPool != address(0)) {
            if (existingPool.code.length == 0) revert PoolIdentityMismatch();
            if (_poolSqrtPrice(existingPool) != sqrtPriceX96) revert PoolPriceMismatch();
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
