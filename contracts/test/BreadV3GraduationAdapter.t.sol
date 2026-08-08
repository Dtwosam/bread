// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {BreadPermanentLiquidityLocker} from "../src/graduation/BreadPermanentLiquidityLocker.sol";
import {BreadV3GraduationAdapter} from "../src/graduation/BreadV3GraduationAdapter.sol";
import {IGraduationAdapter} from "../src/interfaces/IGraduationAdapter.sol";
import {MockUSDC6} from "./helpers/MockUSDC6.sol";

contract MockV3LaunchToken is ERC20 {
    constructor() ERC20("Mock V3 Launch", "MV3") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockV3Pool {
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

contract MockBreadV3Factory {
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
        pool = address(new MockV3Pool());
        _pools[key] = pool;
    }

    function _key(address tokenA, address tokenB, uint24 fee) private pure returns (bytes32) {
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        return keccak256(abi.encode(token0, token1, fee));
    }
}

contract MockBreadV3PositionManager {
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

    address public lastToken0;
    address public lastToken1;
    uint24 public lastFee;
    uint160 public lastSqrtPriceX96;
    int24 public lastTickLower;
    int24 public lastTickUpper;
    address public lastRecipient;
    uint256 public unused0;
    uint256 public unused1;

    constructor(address factory_) {
        factory = factory_;
    }

    function setUnused(uint256 unused0_, uint256 unused1_) external {
        unused0 = unused0_;
        unused1 = unused1_;
    }

    function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96)
        external
        returns (address pool)
    {
        lastToken0 = token0;
        lastToken1 = token1;
        lastFee = fee;
        lastSqrtPriceX96 = sqrtPriceX96;
        pool = MockBreadV3Factory(factory).getPool(token0, token1, fee);
        if (pool == address(0)) pool = MockBreadV3Factory(factory).createPool(token0, token1, fee);
        MockV3Pool(pool).initialize(sqrtPriceX96);
    }

    function mint(MintParams calldata params)
        external
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        require(unused0 <= params.amount0Desired && unused1 <= params.amount1Desired, "BAD_UNUSED");
        amount0 = params.amount0Desired - unused0;
        amount1 = params.amount1Desired - unused1;
        if (amount0 != 0) require(IERC20(params.token0).transferFrom(msg.sender, address(this), amount0));
        if (amount1 != 0) require(IERC20(params.token1).transferFrom(msg.sender, address(this), amount1));

        tokenId = nextTokenId++;
        liquidity = 1;
        ownerOf[tokenId] = params.recipient;
        lastToken0 = params.token0;
        lastToken1 = params.token1;
        lastFee = params.fee;
        lastTickLower = params.tickLower;
        lastTickUpper = params.tickUpper;
        lastRecipient = params.recipient;
    }
}

contract BreadV3AdapterActor {
    function execute(BreadV3GraduationAdapter adapter, IGraduationAdapter.Seed calldata seed) external {
        adapter.execute(seed);
    }
}

contract BreadV3GraduationAdapterTest {
    uint24 private constant FEE = 3_000;
    int24 private constant TICK_SPACING = 60;
    uint256 private constant USDC_AMOUNT = 1_000_000_000;
    uint256 private constant TOTAL_TOKENS = 2_000 ether;
    uint256 private constant POOL_TOKENS = 1_000 ether;

    struct Fixture {
        MockUSDC6 usdc;
        MockV3LaunchToken token;
        BreadPermanentLiquidityLocker locker;
        MockBreadV3Factory factory;
        MockBreadV3PositionManager manager;
        BreadV3GraduationAdapter adapter;
    }

    function testV3AdapterIdentityAndConfigAreImmutableAndDeterministic() public {
        Fixture memory f = _deploy();
        assert(f.adapter.family() == IGraduationAdapter.AdapterFamily.UNISWAP_V3);
        assert(f.adapter.coordinator() == address(this));
        assert(f.adapter.usdc() == address(f.usdc));
        assert(f.adapter.locker() == address(f.locker));
        assert(f.adapter.positionManager() == address(f.manager));
        assert(f.adapter.v3Factory() == address(f.factory));
        assert(f.adapter.fee() == FEE);
        assert(f.adapter.tickSpacing() == TICK_SPACING);
        assert(f.adapter.configHash() != bytes32(0));
    }

    function testValidateSeedRejectsWrongHashAndWrongQuote() public {
        Fixture memory f = _deploy();
        IGraduationAdapter.Seed memory seed = _seed(f);
        f.adapter.validateSeed(seed);

        seed.configHash = bytes32(uint256(1));
        (bool wrongHash,) = address(f.adapter).staticcall(
            abi.encodeWithSelector(f.adapter.validateSeed.selector, seed)
        );
        assert(!wrongHash);

        seed = _seed(f);
        seed.usdc = address(f.token);
        (bool wrongQuote,) = address(f.adapter).staticcall(
            abi.encodeWithSelector(f.adapter.validateSeed.selector, seed)
        );
        assert(!wrongQuote);
    }

    function testExecuteMintsFullRangePositionDirectlyToLockerAndClearsAllowances() public {
        Fixture memory f = _deploy();
        IGraduationAdapter.Result memory result = _execute(f, 0, 0);

        (address token0, address token1) = _ordered(address(f.token), address(f.usdc));
        assert(f.manager.lastToken0() == token0);
        assert(f.manager.lastToken1() == token1);
        assert(f.manager.lastFee() == FEE);
        assert(f.manager.lastSqrtPriceX96() != 0);
        assert(f.manager.lastTickLower() == -887220);
        assert(f.manager.lastTickUpper() == 887220);
        assert(f.manager.lastRecipient() == address(f.locker));
        assert(f.manager.ownerOf(result.positionId) == address(f.locker));
        assert(result.poolId != bytes32(0));
        assert(result.positionManager == address(f.manager));
        assert(result.usdcUsed == USDC_AMOUNT);
        assert(result.tokenUsed == POOL_TOKENS);
        assert(result.usdcDust == 0);
        assert(result.tokenDust == 0);
        assert(f.usdc.allowance(address(f.adapter), address(f.manager)) == 0);
        assert(f.token.allowance(address(f.adapter), address(f.manager)) == 0);
        assert(f.usdc.balanceOf(address(f.adapter)) == 0);
        assert(f.token.balanceOf(address(f.adapter)) == 0);
    }

    function testExecuteReturnsExactResidueToCoordinatorForEitherTokenOrdering() public {
        Fixture memory f = _deploy();
        uint256 usdcDust = 7;
        uint256 tokenDust = 1 ether;
        (uint256 unused0, uint256 unused1) = address(f.usdc) < address(f.token)
            ? (usdcDust, tokenDust)
            : (tokenDust, usdcDust);

        IGraduationAdapter.Result memory result = _execute(f, unused0, unused1);

        assert(result.usdcUsed == USDC_AMOUNT - usdcDust);
        assert(result.tokenUsed == POOL_TOKENS - tokenDust);
        assert(result.usdcDust == usdcDust);
        assert(result.tokenDust == tokenDust);
        assert(f.usdc.balanceOf(address(this)) == usdcDust);
        assert(f.token.balanceOf(address(this)) == tokenDust);
        assert(f.usdc.balanceOf(address(f.adapter)) == 0);
        assert(f.token.balanceOf(address(f.adapter)) == 0);
    }

    function testExecuteIsCoordinatorOnly() public {
        Fixture memory f = _deploy();
        BreadV3AdapterActor actor = new BreadV3AdapterActor();
        (bool ok,) = address(actor).call(
            abi.encodeWithSelector(actor.execute.selector, f.adapter, _seed(f))
        );
        assert(!ok);
        assert(f.manager.nextTokenId() == 1);
    }

    function _execute(Fixture memory f, uint256 unused0, uint256 unused1)
        private
        returns (IGraduationAdapter.Result memory result)
    {
        f.manager.setUnused(unused0, unused1);
        f.usdc.mint(address(this), USDC_AMOUNT);
        f.token.mint(address(this), POOL_TOKENS);
        assert(f.usdc.approve(address(f.adapter), USDC_AMOUNT));
        assert(f.token.approve(address(f.adapter), POOL_TOKENS));
        result = f.adapter.execute(_seed(f));
    }

    function _seed(Fixture memory f) private view returns (IGraduationAdapter.Seed memory seed) {
        seed = IGraduationAdapter.Seed({
            token: address(f.token),
            usdc: address(f.usdc),
            usdcAmount: USDC_AMOUNT,
            totalTokenAmount: TOTAL_TOKENS,
            poolTokenAmount: POOL_TOKENS,
            configHash: f.adapter.configHash()
        });
    }

    function _deploy() private returns (Fixture memory f) {
        f.usdc = new MockUSDC6();
        f.token = new MockV3LaunchToken();
        f.locker = new BreadPermanentLiquidityLocker(address(this));
        f.locker.setCoordinator(address(this));
        f.factory = new MockBreadV3Factory();
        f.factory.setFeeAmount(FEE, TICK_SPACING);
        f.manager = new MockBreadV3PositionManager(address(f.factory));
        f.adapter = new BreadV3GraduationAdapter(
            address(this),
            address(f.usdc),
            address(f.locker),
            address(f.manager),
            address(f.factory),
            FEE
        );
    }

    function _ordered(address a, address b) private pure returns (address token0, address token1) {
        return a < b ? (a, b) : (b, a);
    }
}
