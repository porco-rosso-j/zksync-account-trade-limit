// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Oracle.sol";
import "../../interfaces/ISwapModuleBase.sol";
import "../../interfaces/IModuleManager.sol";
import "../../interfaces/IAccountRegistry.sol";

/*

SwapModuleBase is the base contract for SwapModuleUniV2.
A separate base contract for a module should exist 
since SwapModuleUniV2 is always delegatecalled from Account
and its state variabels can't be read whatsoever,

*/

contract SwapModuleBase is ISwapModuleBase {
    bytes4 public moduleIdentifier = bytes4(keccak256("SWAP_MODULE"));

    address public admin;
    address public moduleManager;
    uint256 public moduleId;

    address public wethAddr;
    Oracle public oracle;

    uint256 public maxTradeAmountUSD;
    uint256 public constant DAY = 864000;
    uint256 public dailyTradeLimit;
    bool public isDailyTradeLimitEnabled;

    struct TradeLimit {
        uint256 available;
        uint256 resetTime;
    }

    mapping(address => TradeLimit) public limits; // account => TradeLimit
    mapping(address => bool) public routers; // router address => bool
    mapping(address => bool) public accounts; // account address => bool
    mapping(address => bool) public validAsset; //  asset => bool: determined by protocol

    constructor(
        address _admin,
        address _moduleManager,
        address _wethAddr,
        address _oracle,
        uint256 _maxTradeAmountUSD
    ) {
        admin = _admin;
        moduleManager = _moduleManager;
        wethAddr = _wethAddr;
        oracle = Oracle(_oracle);
        maxTradeAmountUSD = _maxTradeAmountUSD;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "ONLY_ADMIN");
        _;
    }

    // called by moduleManager
    function setModuleId(uint256 _moduleId) external {
        require(msg.sender == moduleManager, "INVALID_CALLER");
        moduleId = _moduleId;
    }

    /// operations
    function setMaxTradeAmountUSD(uint256 _amount) public onlyAdmin {
        maxTradeAmountUSD = _amount;
    }

    function addRouter(address _router) public onlyAdmin {
        routers[_router] = true;
    }

    function removeRouter(address _router) public onlyAdmin {
        require(isRouterEnabled(_router), "NOT_ENABLED");
        routers[_router] = false;
    }

    function enableAsset(address[] memory _tokens) public onlyAdmin {
        for (uint256 i; i < _tokens.length; i++) {
            require(_tokens[i] != address(0), "INVALID_ADDRESS");
            validAsset[_tokens[i]] = true;
        }
    }

    function enabledDailyTradeLimit(uint256 _dailyTradeLimit) public onlyAdmin {
        require(!isDailyTradeLimitEnabled, "ALREADY_ENABLED");
        isDailyTradeLimitEnabled = true;
        setDailyTradeLimit(_dailyTradeLimit);
    }

    function setDailyTradeLimit(uint256 _dailyTradeLimit) public onlyAdmin {
        require(_dailyTradeLimit != 0, "INVALID_AMOUNT");
        dailyTradeLimit = _dailyTradeLimit;
    }

    function addAccount(address _account) public {
        address registry = IModuleManager(moduleManager).accountRegistry();
        require(
            IAccountRegistry(registry).isAccount(_account),
            "INAVLID_ACCOUNT"
        );
        accounts[_account] = true;
    }

    function removeAccount(address _account) public {
        require(
            IAccountRegistry(IModuleManager(moduleManager).accountRegistry())
                .isAccount(_account),
            "INAVLID_ACCOUNT"
        );
        require(isAccountEnabled(_account), "NOT_ENABLED");
        accounts[_account] = false;
    }

    function isAccountEnabled(address _account) public view returns (bool) {
        return accounts[_account];
    }

    function isRouterEnabled(address _router) internal view returns (bool) {
        return routers[_router];
    }

    function _isValidTrade(
        address _account,
        address _router,
        uint256 _amount,
        address[] memory _path
    ) external returns (bool) {
        require(isRouterEnabled(_router), "ROUTER_NOT_ENABLED");

        for (uint256 i; i < _path.length; i++) {
            require(validAsset[_path[i]], "INVALID_ASSET");
        }

        uint256 tradeSizeUSD = getTradeSize(_path[0], _amount);
        require(tradeSizeUSD <= maxTradeAmountUSD, "AMOUNT_EXCEEDS_MAX_AMOUNT");

        if (isDailyTradeLimitEnabled) {
            _checkTradeLimit(_account, tradeSizeUSD);
        }

        return true;
    }

    function _checkTradeLimit(address _account, uint256 _amount) internal {
        TradeLimit memory limit = limits[_account];

        uint256 timestamp = block.timestamp;

        if (dailyTradeLimit != limit.available && timestamp > limit.resetTime) {
            limit.resetTime = timestamp + DAY;
            limit.available = dailyTradeLimit;
        } else if (dailyTradeLimit == limit.available) {
            limit.resetTime = timestamp + DAY;
        }

        require(limit.available >= _amount, "EXCEED_DAILY_LIMIT");
        limit.available -= _amount;
        limits[_account] = limit;
    }

    function getTradeSize(address _token, uint256 _amount)
        public
        view
        returns (uint256)
    {
        // use oralce to be manipulation-resistnat
        uint256 price = oracle.getAssetPrice(_token);
        return (_amount * price) / 1e18;
    }

    function checkTradeLimit(
        address _account,
        address _token,
        uint256 _amount
    ) public view returns (bool, uint256) {
        uint256 tradeSize = getTradeSize(_token, _amount);
        bool isAvailable = limits[_account].available >= tradeSize
            ? true
            : false;
        return (isAvailable, limits[_account].available);
    }
}
