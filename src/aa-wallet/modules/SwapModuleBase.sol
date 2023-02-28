// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Oracle.sol";

interface ISwapModuleBase {
    function isAccountEnabled(address _account) external view returns (bool);

    function _isValidTrade(uint256 _amount, address[] memory _path)
        external
        view
        returns (bool);
}

contract SwapModuleBase {
    address public admin;
    Oracle public oracle;

    uint256 public maxTradeAmountUSD;

    mapping(address => bool) public routers;
    mapping(address => bool) public accounts;
    mapping(address => bool) public validAsset; // swapRouter => asset => bool: determined by protocol

    constructor(
        address _admin,
        address _oracle,
        uint256 _maxTradeAmountUSD
    ) {
        admin = _admin;
        oracle = Oracle(_oracle);
        maxTradeAmountUSD = _maxTradeAmountUSD;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "ONLY_AMIN");
        _;
    }

    function isAccountEnabled(address _account) public view returns (bool) {
        return accounts[_account];
    }

    function isRouterEnabled(address _router) internal view returns (bool) {
        return routers[_router];
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

    function addAccount(address _account) public {
        accounts[_account] = true;
    }

    function removeAccount(address _account) public {
        require(isAccountEnabled(_account), "NOT_ENABLED");
        accounts[_account] = false;
    }

    function enableAsset(address[] memory _tokens) public onlyAdmin {
        for (uint256 i; i < _tokens.length; i++) {
            require(_tokens[i] != address(0), "INVALID_ADDRESS");
            validAsset[_tokens[i]] = true;
        }
    }

    function _isValidTrade(uint256 _amount, address[] memory _path)
        external
        view
        returns (bool)
    {
        for (uint256 i; i < _path.length; i++) {
            require(validAsset[_path[i]], "INVALID_ASSET");
        }

        uint256 price = oracle.getAssetPrice(_path[0]);
        uint256 tradeSizeUSD = (_amount * price) / 1e18;
        require(tradeSizeUSD <= maxTradeAmountUSD, "AMOUNT_EXCEEDS_MAX_AMOUNT");

        return true;
    }

    function tradeSize(address _token, uint256 _amount)
        public
        view
        returns (uint256)
    {
        uint256 price = oracle.getAssetPrice(_token);
        return (_amount * price) / 1e18;
    }
}
