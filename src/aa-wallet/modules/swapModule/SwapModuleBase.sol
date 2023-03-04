// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Oracle.sol";
import "../../interfaces/ISwapModuleBase.sol";
import "../../interfaces/IModuleManager.sol";
import "../../interfaces/IAccountRegistry.sol";

/**
@title SwapModuleBase Contract that serves as the base and helper for SwapModuleUniV2
@author Porco Rosso<porcorossoj89@gmail.com>
@dev 
Account always delegatecall SwapModuleUniV2. 
Thus, this separate base contract should store needed variables with validation logics.

*/

contract SwapModuleBase is ISwapModuleBase {
    bytes4 public moduleIdentifier = bytes4(keccak256("SWAP_MODULE"));

    address public admin;
    address public moduleManager;
    uint256 public moduleId;

    address public wethAddr;
    Oracle public oracle;

    uint256 public maxTradeAmountUSD;
    uint256 public constant DAY = 86400;
    uint256 public dailyTradeLimit;
    bool public isDailyTradeLimitEnabled;

    /// @param available the available amount to trade
    /// @param resetTime block.timestamp at which available amount is restored
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

    /**
    @notice function that is called by moduleManager to set moduleId
    @param _moduleId the identifier number of a module
     */
    function setModuleId(uint256 _moduleId) external {
        require(msg.sender == moduleManager, "INVALID_CALLER");
        moduleId = _moduleId;
    }

    /// @notice function sets maxTradeAmountUSD
    function setMaxTradeAmountUSD(uint256 _amount) public onlyAdmin {
        maxTradeAmountUSD = _amount;
    }

    /// @notice function enables router
    function addRouter(address _router) public onlyAdmin {
        routers[_router] = true;
    }

    /// @notice function disables router
    function removeRouter(address _router) public onlyAdmin {
        require(isRouterEnabled(_router), "NOT_ENABLED");
        routers[_router] = false;
    }

    /// @notice function enables assets for trading on swapModule
    function enableAsset(address[] memory _tokens) public onlyAdmin {
        for (uint256 i; i < _tokens.length; i++) {
            require(_tokens[i] != address(0), "INVALID_ADDRESS");
            validAsset[_tokens[i]] = true;
        }
    }

    /// @notice function enables daily trading limit
    function enabledDailyTradeLimit(uint256 _dailyTradeLimit) public onlyAdmin {
        require(!isDailyTradeLimitEnabled, "ALREADY_ENABLED");
        isDailyTradeLimitEnabled = true;
        setDailyTradeLimit(_dailyTradeLimit);
    }

    /// @notice function changes daily trading limit
    function setDailyTradeLimit(uint256 _dailyTradeLimit) public onlyAdmin {
        require(_dailyTradeLimit != 0, "INVALID_AMOUNT");
        dailyTradeLimit = _dailyTradeLimit;
    }

    /// @notice function called by Account in addModules() to enable account
    function addAccount(address _account) public {
        address registry = IModuleManager(moduleManager).accountRegistry();
        require(
            IAccountRegistry(registry).isAccount(_account),
            "INAVLID_ACCOUNT"
        );
        accounts[_account] = true;
    }

    /// @notice function called by Account in addModules() to disable account
    function removeAccount(address _account) public {
        require(
            IAccountRegistry(IModuleManager(moduleManager).accountRegistry())
                .isAccount(_account),
            "INAVLID_ACCOUNT"
        );
        require(isAccountEnabled(_account), "NOT_ENABLED");
        accounts[_account] = false;
    }

    /// @notice view function to check if the account is enabled
    function isAccountEnabled(address _account) public view returns (bool) {
        return accounts[_account];
    }

    /// @notice view function to check if the router is enabled
    function isRouterEnabled(address _router) internal view returns (bool) {
        return routers[_router];
    }

    /**
    @notice method to validate if the trade is valid
    @param _account the account address that trades through this module
    @param _router the router address that this module interacts with
    @param _amount the amount of trade-size in USD
    @param _path the swap path
     */
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

    /**
    @notice method to check if the amount exceeds the available amount and throws an error otherwise.
    @notice this function is mostly based on my SpendLimit implementation of AA daily spend limit tutorial's code
    @notice see: https://github.com/porco-rosso-j/daily-spendlimit-tutorial/blob/main/contracts/SpendLimit.sol
    @param _account the account address that trades through this module
    @param _amount the amount of trade-size in USD
    @dev block.timestamp on zkSync is delayed 10-15mins compared to L1's timestamp but its negligible for this dapp.
     */
    function _checkTradeLimit(address _account, uint256 _amount) internal {
        TradeLimit memory limit = limits[_account];

        uint256 timestamp = block.timestamp;

        // Renew resetTime and available amount, which is only performed
        // if a day has already passed since the last update : timestamp > resetTime
        if (dailyTradeLimit != limit.available && timestamp > limit.resetTime) {
            limit.resetTime = timestamp + DAY;
            limit.available = dailyTradeLimit;

            // Or only resetTime is updated if it's the first trade after enabling limit
        } else if (dailyTradeLimit == limit.available) {
            limit.resetTime = timestamp + DAY;
        }

        // reverts if the amount exceeds the remaining available amount.
        require(limit.available >= _amount, "EXCEED_DAILY_LIMIT");

        // decrement `available`
        limit.available -= _amount;
        limits[_account] = limit;
    }

    /// @notice returns the value of the trade calculated with the price fetched from oracle(mock)
    function getTradeSize(address _token, uint256 _amount)
        public
        view
        returns (uint256)
    {
        // use oralce to be manipulation-resistnat
        uint256 price = oracle.getAssetPrice(_token);
        return (_amount * price) / 1e18;
    }

    /// @dev view method to see Trade Limit for account. For integration or front-end uses.
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
