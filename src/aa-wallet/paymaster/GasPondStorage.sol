//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

abstract contract GasPondStorage {
    address public owner;
    address public moduleManager;
    uint256 public constant DECIMAL_PRECISION = 1e18;
    uint256 public minimumETHBalance = 1e16; // 0.01 ETH

    uint256 swapModuleId;

    struct Sponsor {
        bool isValidSponsor;
        bool isGeneralFlowSupported;
        uint256 ethBalance;
        mapping(address => uint256) erc20Balances; // token => balnace
        mapping(address => bool) enabledModules;
        mapping(address => ERC20Payment) erc20payments; //  token => ERC20Payment
    }

    struct ERC20Payment {
        uint256 maxFee;
        uint256 minFee;
        uint256 discountRate; // default 0, say, can be 50% (5e17)
        bool isEnabled;
    }

    struct Module {
        uint256 moduleId;
        address moduleBaseAddr;
        bool isValid;
    }

    mapping(address => Module) public modules;
    mapping(address => Sponsor) public sponsors; // sponsor address => Sponsor
}
