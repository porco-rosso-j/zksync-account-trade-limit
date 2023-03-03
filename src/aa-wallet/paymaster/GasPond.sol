//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {IPaymaster, ExecutionResult, PAYMASTER_VALIDATION_SUCCESS_MAGIC} from "zksync-contracts/interfaces/IPaymaster.sol";
import {TransactionHelper, Transaction} from "zksync-contracts/libraries/TransactionHelper.sol";
import {BOOTLOADER_FORMAL_ADDRESS} from "zksync-contracts/Constants.sol";

import {GasPondStorage} from "./GasPondStorage.sol";
import {GasPondHelper} from "./helpers/GasPondHelper.sol";
import {GasPondTokenHelper} from "./helpers/GasPondTokenHelper.sol";

import {IModuleManager} from "../interfaces/IModuleManager.sol";
import {IModule} from "../interfaces/IModule.sol";
import {SwapModuleDecoder} from "./lib/SwapModuleDecoder.sol";

/*

Module Paymaster called GasPond that allow either free tx or ERC20 gas payment
for an AA-Wallet's transactions via its enabled modules. 

Sponsor: Sponsors are those who deposit funds to sponsor users' gas payment. 
Anyone can register as sponsor and set preferable gas-sponsoring configurations.

E.g: 
- in default, dismiss General Flow but accept ApprovaleBased Flow
- Only support enabled modules, e.g. swapModule
- Only support enabled certain ERC20 assets as payment method

*/

contract GasPond is
    IPaymaster,
    GasPondStorage,
    GasPondHelper,
    GasPondTokenHelper
{
    using TransactionHelper for Transaction;
    using SwapModuleDecoder for bytes;

    modifier onlyBootloader() {
        require(msg.sender == BOOTLOADER_FORMAL_ADDRESS, "NOT_BOOTLOADER");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor(
        address _weth,
        address _swapRouter,
        address _moduleManager
    ) GasPondTokenHelper(_weth, _swapRouter) {
        owner = msg.sender;
        moduleManager = _moduleManager;
    }

    // ================================================================= //
    //                          Admin Operations                         //
    // ================================================================= //

    function _isValidSponsor(address _sponsor) internal view returns (bool) {
        if (sponsors[_sponsor].isValidSponsor) {
            return true;
        } else {
            return false;
        }
    }

    function addModule(uint256 _moduleId) public onlyOwner {
        require(_moduleId != 0, "INVALID_NUMBER");

        (address _moduleAddr, address _moduleBaseAddr) = IModuleManager(
            moduleManager
        ).getModule(_moduleId);

        Module storage module = modules[_moduleAddr];
        module.moduleId = _moduleId;
        module.moduleBaseAddr = _moduleBaseAddr;
        module.isValid = true;
    }

    function removeModule(uint256 _moduleId) public onlyOwner {
        require(_moduleId != 0, "INVALID_NUMBER");

        (address _moduleAddr, ) = IModuleManager(moduleManager).getModule(
            _moduleId
        );

        Module storage module = modules[_moduleAddr];

        require(module.isValid, "NOT_ENABLED");
        module.isValid = false;
    }

    // ================================================================= //
    //                        Paymaster Validation                       //
    // ================================================================= //

    function validateAndPayForPaymasterTransaction(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    )
        external
        payable
        override
        onlyBootloader
        returns (bytes4 magic, bytes memory)
    {
        magic = PAYMASTER_VALIDATION_SUCCESS_MAGIC;

        require(_transaction.paymasterInput.length >= 4, "INVALID_BYTE_LENGTH");

        address to = address(uint160(_transaction.to));

        uint256 eth_fee = _transaction.gasLimit * _transaction.maxFeePerGas;
        address sponsorAddr;

        if (_isApprovalBased(bytes4(_transaction.paymasterInput[0:4]))) {
            (
                address token,
                uint256 allowance,
                address _sponsorAddr
            ) = _getApprovalBasedParams(_transaction.paymasterInput[4:]);

            sponsorAddr = _sponsorAddr;

            _approvalBasedFlow(
                token,
                allowance,
                sponsorAddr,
                _transaction,
                eth_fee
            );
        } else {
            if (!sponsors[sponsorAddr].isGeneralFlowSupported)
                revert("GENERAL_FLOW_UNSUPPORTED");
            sponsorAddr = _getGeneralParams(_transaction.paymasterInput[4:]);
        }

        if (modules[to].isValid) {
            require(
                sponsors[sponsorAddr].enabledModules[to],
                "UNSUPPORTED_MODULE"
            );
        }

        _isValidSponsor(sponsorAddr);

        require(
            sponsors[sponsorAddr].ethBalance >= eth_fee,
            "INSUFFICIENT_SPONSOR_BALANCE"
        );

        _payErgs(sponsorAddr, eth_fee);
    }

    function _payErgs(address _sponsorAddr, uint256 _eth_fee) internal {
        (bool success, ) = payable(BOOTLOADER_FORMAL_ADDRESS).call{
            value: _eth_fee
        }("");
        require(success, "GAS_PAYMENT_FAILED");

        sponsors[_sponsorAddr].ethBalance -= _eth_fee;
    }

    function _approvalBasedFlow(
        address _token,
        uint256 _allowance,
        address _sponsorAddr,
        Transaction calldata _transaction,
        uint256 _eth_fee
    ) internal {
        ERC20Payment storage erc20payment = sponsors[_sponsorAddr] //
            .erc20payments[_token];

        require(erc20payment.isEnabled, "NOT_ENABLED");
        require(erc20payment.minFee <= _allowance, "INVALID_ALLOWANCE");

        address from = address(uint160(_transaction.from));
        address to = address(uint160(_transaction.to));

        _validatePaymentToken(
            _token,
            _sponsorAddr,
            from,
            to,
            _transaction.data
        );

        uint256 token_fee = _getTokenFee(_token, _eth_fee);

        require(erc20payment.maxFee >= token_fee, "EXCEED_MAXFEE");

        if (erc20payment.discountRate != 0) {
            token_fee =
                (token_fee * erc20payment.discountRate) /
                DECIMAL_PRECISION;
        }

        _payInERC20(_token, from, token_fee);

        sponsors[_sponsorAddr].erc20Balances[_token] += token_fee;
    }

    function _validatePaymentToken(
        address _token,
        address _sponsorAddr,
        address _from,
        address _to,
        bytes calldata _data
    ) internal view {
        require(isGasPayableERC20(_token, _sponsorAddr), "NOT_SUPPORTED");

        bool isSwapModule = _isSwapModule(_to);

        if (isSwapModule) {
            _isValidTokenIn(_token, _data);
        } else if (bytes4(_data[0:4]) == bytes4(0x29451959) && _from == _to) {
            // 0x29451959 = BATCH_TX_SELECTOR
            // validation in case of batch transaction
            (, address[] memory targets, bytes[] memory methods, ) = abi.decode(
                _data[4:],
                (bool[], address[], bytes[], uint256[])
            );

            for (uint256 i; i < targets.length; i++) {
                isSwapModule = _isSwapModule(_to);
                if (isSwapModule) _isValidTokenIn(_token, methods[i]);
            }
        }
    }

    function _isValidTokenIn(address _token, bytes memory _data) internal pure {
        (, address[] memory path) = SwapModuleDecoder.decodeSwapArgs(_data);
        if (path[0] != _token) revert("INVALID_TOKENIN");
    }

    function _isSwapModule(address _to) internal view returns (bool) {
        address base = modules[_to].moduleBaseAddr;

        return
            modules[_to].isValid &&
            IModule(base).moduleIdentifier() ==
            bytes4(keccak256("SWAP_MODULE"));
    }

    function postTransaction(
        bytes calldata _context,
        Transaction calldata _transaction,
        bytes32,
        bytes32,
        ExecutionResult _txResult,
        uint256 _maxRefundedGas
    ) external payable override {
        // Refunds are not supported yet.
    }

    // ================================================================= //
    //                      Sponsor Configurations                       //
    // ================================================================= //

    // --- Paymaster's Registration & Set-up --- //

    function registerSponsor() public payable {
        require(msg.value >= minimumETHBalance, "INVALIT_AMOUNT");
        require(!sponsors[msg.sender].isValidSponsor, "ALREADY_VALID");

        sponsors[msg.sender].isValidSponsor = true;
        sponsors[msg.sender].ethBalance = msg.value;
    }

    function enableSponsoringModules(address[] memory _modules) public {
        Sponsor storage sponsor = sponsors[msg.sender];
        require(sponsor.isValidSponsor, "ALREADY_VALID");

        for (uint256 i = 0; i < _modules.length; i++) {
            sponsor.enabledModules[_modules[i]] = true;
        }
    }

    function disableSponsoringModules(address[] memory _modules) public {
        Sponsor storage sponsor = sponsors[msg.sender];
        require(sponsor.isValidSponsor, "ALREADY_VALID");

        for (uint256 i = 0; i < _modules.length; i++) {
            require(sponsor.enabledModules[_modules[i]], "NOT_ENABLED");
            sponsor.enabledModules[_modules[i]] = true;
        }
    }

    function enableGeneralFlow() public {
        Sponsor storage sponsor = sponsors[msg.sender];
        require(sponsor.isValidSponsor, "ALREADY_VALID");
        sponsor.isGeneralFlowSupported = true;
    }

    function disableGeneralFlow() public {
        Sponsor storage sponsor = sponsors[msg.sender];
        require(sponsor.isValidSponsor, "ALREADY_VALID");
        require(sponsor.isGeneralFlowSupported, "NOT_ENABLED");
        sponsor.isGeneralFlowSupported = false;
    }

    // --- Paymaster's ERC20 Configurations --- //

    function setERC20PaymentInfo(
        address _token,
        uint256 _maxFee,
        uint256 _minFee,
        uint256 _discountRate
    ) public {
        require(_isValidSponsor(msg.sender), "INVALID_SPONSOR");
        require(_token != address(0), "INVALID_TOKEN");
        require(_maxFee != 0, "INVALID_AMOUNT");
        require(_minFee < _maxFee, "INVALID_AMOUNT");
        require(_discountRate <= 1e18, "INVALID_AMOUNT");

        ERC20Payment storage erc20payment = sponsors[msg.sender].erc20payments[
            _token
        ];

        erc20payment.maxFee = _maxFee;
        erc20payment.minFee = _minFee;
        erc20payment.discountRate = _discountRate;
        erc20payment.isEnabled = true;
    }

    function removeERC20PaymentInfo(address _token) public {
        require(_isValidSponsor(msg.sender), "INVALID_SPONSOR");
        require(_token != address(0), "INVALID_TOKEN");

        ERC20Payment storage erc20payment = sponsors[msg.sender].erc20payments[
            _token
        ];

        require(!erc20payment.isEnabled, "NOT_ENABLED");

        erc20payment.maxFee = 0;
        erc20payment.minFee = 0;
        erc20payment.discountRate = 0;
        erc20payment.isEnabled = false;
    }

    // --- Paymaster's Token Operations --- //

    function depositETH() public payable returns (uint256) {
        require(_isValidSponsor(msg.sender), "INVALID_SPONSOR");
        sponsors[msg.sender].ethBalance += msg.value;
        return sponsors[msg.sender].ethBalance;
    }

    function withdrawETH(uint256 _amount) public {
        require(_isValidSponsor(msg.sender), "INVALID_SPONSOR");
        require(_amount != 0, "INVALID_AMOUNT");
        require(
            sponsors[msg.sender].ethBalance >= _amount,
            "INSUFFICIENT_AMOUNT"
        );
        _withdrawETH(_amount);
    }

    // ================================================================= //
    //                      Sponsor View Funcitons                       //
    // ================================================================= //

    function getSponsorETHBalance(address _sponsor)
        public
        view
        returns (uint256)
    {
        return sponsors[_sponsor].ethBalance;
    }

    function getSponsorERC20Balance(address _sponsor, address _token)
        public
        view
        returns (uint256)
    {
        return sponsors[_sponsor].erc20Balances[_token];
    }

    function getERC20PaymentInfo(address _sponsor, address _token)
        public
        view
        returns (
            uint256,
            uint256,
            uint256,
            bool
        )
    {
        ERC20Payment storage erc20payment = sponsors[_sponsor].erc20payments[
            _token
        ];
        return (
            erc20payment.maxFee,
            erc20payment.minFee,
            erc20payment.discountRate,
            erc20payment.isEnabled
        );
    }

    function isGasPayablePath(address[] memory path, address _sponsorAddr)
        public
        view
        returns (bool)
    {
        bool result;
        for (uint256 i = 0; i < path.length; i++) {
            result = isGasPayableERC20(path[i], _sponsorAddr);
            if (result) return true;
        }

        return false;
    }

    function isGasPayableERC20(address _token, address _sponsorAddr)
        public
        view
        returns (bool)
    {
        Sponsor storage sponsor = sponsors[_sponsorAddr];
        if (
            sponsor.ethBalance >= minimumETHBalance &&
            sponsor.erc20payments[_token].isEnabled
        ) {
            return true;
        }
        return false;
    }

    receive() external payable {
        depositETH();
    }
}
