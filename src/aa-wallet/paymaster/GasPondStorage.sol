//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

/**
@title Storage Contract for GasPond.sol.
@author Porco Rosso<porcorossoj89@gmail.com>
@notice This abstract contract serves as a single data storage for GasPond contract.

*/
abstract contract GasPondStorage {
    address public owner;
    address public moduleManager;
    uint256 public constant DECIMAL_PRECISION = 1e18;
    uint256 public minimumETHBalance = 1e16; // 0.01 ETH

    /**
    @param isValidSponsor true if the address has already been regsistered as a sponsor 
    @param isGeneralFlowSupported true if isGeneralFlowSupported is enabled. false by default
    @param ethBalance the amount of sponsor's deposited ETH
    */
    struct Sponsor {
        bool isValidSponsor;
        bool isGeneralFlowSupported;
        uint256 ethBalance;
        mapping(address => uint256) erc20Balances; // token address => balnace
        mapping(address => bool) enabledModules; // module addresa => enabled or not
        mapping(address => ERC20Payment) erc20payments; //  token address => ERC20Payment
    }

    /**
    @param _maxFee the max amount of eth that sponsor accepts as gas-payment
    @param _minFee the minimum amount of eth that sponsor accepts as gas-payment
    @param _discountRate the rate (from 0 to 1e18) for discount applied to gas-payments in the given ERC20
    @param isEnabled true if the given token is enabled as a gas-payment token
    */
    struct ERC20Payment {
        uint256 maxFee;
        uint256 minFee;
        uint256 discountRate; // default 0, say, can be 50% (5e17)
        bool isEnabled;
    }

    /**
    @param _moduleId the identifier number of a module.
    @param moduleBaseAddr the address of the moduleBase contract
    @param isValid true if module is authorized by owner
    */
    struct Module {
        uint256 moduleId;
        address moduleBaseAddr;
        bool isValid;
    }

    mapping(address => Module) public modules; // module address => Module
    mapping(address => Sponsor) public sponsors; // sponsor address => Sponsor
}
