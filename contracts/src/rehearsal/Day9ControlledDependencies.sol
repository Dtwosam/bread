// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice TEST/REHEARSAL ONLY. This contract is never a canonical Arc dependency.
contract Day9RehearsalUSDC6 is ERC20 {
    constructor() ERC20("Bread Day9 Rehearsal USDC", "rUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice TEST/REHEARSAL ONLY contract-admin target used to prove no durable EOA owns Bread after deployment.
contract Day9ProtocolAdminHarness {
    error CallFailed(bytes data);

    function execute(address target, bytes calldata data) external returns (bytes memory result) {
        (bool ok, bytes memory returned) = target.call(data);
        if (!ok) revert CallFailed(returned);
        return returned;
    }
}

/// @notice TEST/REHEARSAL ONLY minimal V3 pool interface fixture.
contract Day9RehearsalV3Pool {
    uint160 private _sqrtPriceX96;

    function initialize(uint160 sqrtPriceX96_) external {
        if (_sqrtPriceX96 == 0) {
            _sqrtPriceX96 = sqrtPriceX96_;
            return;
        }
        require(_sqrtPriceX96 == sqrtPriceX96_, "PRICE_MISMATCH");
    }

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
        )
    {
        return (_sqrtPriceX96, 0, 0, 0, 0, 0, true);
    }
}

/// @notice TEST/REHEARSAL ONLY minimal V3 factory interface fixture.
contract Day9RehearsalV3Factory {
    mapping(uint24 fee => int24 spacing) public feeAmountTickSpacing;
    mapping(bytes32 key => address pool) private _pools;

    function setFeeAmount(uint24 fee, int24 spacing) external {
        feeAmountTickSpacing[fee] = spacing;
    }

    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool) {
        return _pools[_key(tokenA, tokenB, fee)];
    }

    function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool) {
        bytes32 key = _key(tokenA, tokenB, fee);
        require(_pools[key] == address(0), "POOL_EXISTS");
        pool = address(new Day9RehearsalV3Pool());
        _pools[key] = pool;
    }

    function _key(address tokenA, address tokenB, uint24 fee) private pure returns (bytes32) {
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        return keccak256(abi.encode(token0, token1, fee));
    }
}

/// @notice TEST/REHEARSAL ONLY minimal V3 position-manager interface fixture.
contract Day9RehearsalV3PositionManager {
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

    address public immutable factory;
    uint256 public nextTokenId = 1;
    mapping(uint256 tokenId => address owner) public ownerOf;

    constructor(address factory_) {
        factory = factory_;
    }

    function createAndInitializePoolIfNecessary(
        address token0,
        address token1,
        uint24 fee,
        uint160 sqrtPriceX96
    ) external returns (address pool) {
        pool = Day9RehearsalV3Factory(factory).getPool(token0, token1, fee);
        if (pool == address(0)) pool = Day9RehearsalV3Factory(factory).createPool(token0, token1, fee);
        Day9RehearsalV3Pool(pool).initialize(sqrtPriceX96);
    }

    function mint(MintParams calldata params)
        external
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;
        if (amount0 != 0) require(IERC20(params.token0).transferFrom(msg.sender, address(this), amount0));
        if (amount1 != 0) require(IERC20(params.token1).transferFrom(msg.sender, address(this), amount1));

        tokenId = nextTokenId++;
        liquidity = 1;
        ownerOf[tokenId] = params.recipient;
    }
}
