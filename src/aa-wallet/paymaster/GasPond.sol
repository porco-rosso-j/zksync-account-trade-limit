//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {IPaymaster, ExecutionResult, PAYMASTER_VALIDATION_SUCCESS_MAGIC} from "zksync-contracts/interfaces/IPaymaster.sol";
import {TransactionHelper, Transaction} from "zksync-contracts/libraries/TransactionHelper.sol";
import {BOOTLOADER_FORMAL_ADDRESS} from "zksync-contracts/Constants.sol";

import {GasPondStorage} from "./GasPondStorage.sol";
import {GasPondHelper} from "./helpers/GasPondHelper.sol";
import {GasPondTokenHelper} from "./helpers/GasPondTokenHelper.sol";

import {IAccountRegistry} from "../interfaces/IAccountRegistry.sol";
import {IModuleManager} from "../interfaces/IModuleManager.sol";
import {IModule} from "../interfaces/IModule.sol";
import {SwapModuleDecoder} from "./lib/SwapModuleDecoder.sol";

/**
@title Paymaster Contract called GasPond that allows either free tx or ERC20 gas payment for accounts.
@author Porco Rosso<porcorossoj89@gmail.com>
@notice This paymaster doesn't only allow an contract owner but also registered sponsors to sponsor gas-payments.
@notice Sponsors must deposit ETH and configure the types of transaction they support.

@dev Configuretions that sponsors set
- Paymaster Flow: sponsors should enable both General and ApprovalBased paymaster flow
- ERC20 tokens: sponsors can determine what ERC20 tokens they accept as gas-payment options
- Modules: sponsors can enable certain modules e.g. swapModule and only sponsor accounts' transactions using the modules.

@dev Rationals for the one-paymster-contract-with-many-sponsors model.
GasPond also reduces the costs for those who want to sponsor users' gas-payment to serve as paymasters.
Instead of writing codes and deploy their own paymaster contracts, all they have to do is just to call GasPond to set sponsor-configs depending on their needs.

Additionally, this model can eliminate the risks that users have to trust a random number of unknown paymasters where some could have malicious codes.
GasPond accepts anyone to be a sponsor but only allows them to execute specific functions which are limtied and open-source.

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

    /**
    @notice this inner view functions returns true if the sponsor address is valid
    @param _sponsor the address of sponsor passed in paymasterInput
     */
    function _isValidSponsor(address _sponsor) internal view returns (bool) {
        if (sponsors[_sponsor].isValidSponsor) {
            return true;
        } else {
            return false;
        }
    }

    /**
    @notice this function addes modules that are verifed by ModuleManager.
    @dev it stores moduleId, mdoule addresses in Module struct in modules mapping.
    @param _moduleId the identifier number of a module.
     */
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

    /**
    @notice this function removes that are already added by addModule().
    @dev it turns isValid boolean value false in Module struct in modules mapping.
    @param _moduleId the identifier number of a module.
     */
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

    /**
    @notice this function procesess all the validation logics for gas-sponsored transactions.
    @param _transaction the transaction struct defined by Transaction struct in TransactionHelper.
    @return magic the bytes4 value, PAYMASTER_VALIDATION_SUCCESS_MAGIC if the transaction is consired valid.
     */
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

        address from = address(uint160(_transaction.from));
        address to = address(uint160(_transaction.to));

        // validate that the caller that account is registered in acountRegistry
        // if not revert.
        address registry = IModuleManager(moduleManager).accountRegistry();
        require(IAccountRegistry(registry).isAccount(from), "INVALID_ACCOUNT");

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
            // By default isGeneralFlowSupported is false
            // Sponsor has to configure it true by calling enableGeneralFlow()
            if (!sponsors[sponsorAddr].isGeneralFlowSupported)
                revert("GENERAL_FLOW_UNSUPPORTED");
            sponsorAddr = _getGeneralParams(_transaction.paymasterInput[4:]);
        }

        // when callee is an enabled module,
        // whether or not the specified sponsor has also enabled it must be checked.
        if (modules[to].isValid) {
            require(
                sponsors[sponsorAddr].enabledModules[to],
                "UNSUPPORTED_MODULE"
            );
        }

        _isValidSponsor(sponsorAddr);

        // GasPond must have sufficient ETH to pay the gas fee
        require(
            sponsors[sponsorAddr].ethBalance >= eth_fee,
            "INSUFFICIENT_SPONSOR_BALANCE"
        );

        _payErgs(sponsorAddr, eth_fee);
    }

    /**
    @notice funciton to pay the gas fee to BOOTLOADER_FORMAL_ADDRESS on behalf of the user.
    @param _sponsorAddr the address of sponsor that GasPond reduces deposit balance.
    @param _eth_fee the amount of the gas fee paid to Bootloader.
     */
    function _payErgs(address _sponsorAddr, uint256 _eth_fee) internal {
        (bool success, ) = payable(BOOTLOADER_FORMAL_ADDRESS).call{
            value: _eth_fee
        }("");
        require(success, "GAS_PAYMENT_FAILED");

        // decrement the sponsor's ethBalance.
        sponsors[_sponsorAddr].ethBalance -= _eth_fee;
    }

    /**
    @notice this innner function carries out validations for transactions with approvalBasedFlow. 
    @notice Validation likely fails unless the specified sponsor has enabled gas-payment and configured values in the ERC20Payment struct correctly. 
    @param _token the address of the ERC20 token sent from the sender to this address as a gas payment
    @param _allowance the amount of allowance that the sender gave to this address
    @param _sponsorAddr the address of sponsor that the sender specified
    @param _transaction the transaction struct defined by Transaction struct in TransactionHelper.
    @param _eth_fee the amount of the gas fee paid to Bootloader.
     */
    function _approvalBasedFlow(
        address _token,
        uint256 _allowance,
        address _sponsorAddr,
        Transaction calldata _transaction,
        uint256 _eth_fee
    ) internal {
        ERC20Payment storage erc20payment = sponsors[_sponsorAddr]
            .erc20payments[_token];

        require(erc20payment.isEnabled, "NOT_ENABLED");
        require(erc20payment.minFee <= _allowance, "INVALID_ALLOWANCE");

        address from = address(uint160(_transaction.from));
        address to = address(uint160(_transaction.to));

        // revert if the sponsor doesn't enable the gas-payment in `_token`
        require(isGasPayableERC20(_token, _sponsorAddr), "NOT_SUPPORTED");

        _validatePaymentToken(_token, from, to, _transaction.data);

        uint256 token_fee = _getTokenFee(_token, _eth_fee);

        require(erc20payment.maxFee >= token_fee, "EXCEED_MAXFEE");

        // if discountRate is non-zero, the amount of token_fee decreases depending on the rate
        if (erc20payment.discountRate != 0) {
            token_fee =
                (token_fee * erc20payment.discountRate) /
                DECIMAL_PRECISION;
        }

        _payInERC20(_token, from, token_fee);

        // sponsor's token balance is decremented by token_fee amount.
        sponsors[_sponsorAddr].erc20Balances[_token] += token_fee;
    }

    /**
    @notice For accounts' swap transactions via swapModule, an array param `path[0]` for swapModule should be the same as the `_token`.
    @notice In other words, an error occurs if the input token address for swap isn't the same as `_token` address for gas-payment.
    @dev the validation doesn't exclude a swap in batched transactions. 
    @param _token the address of the ERC20 token sent from the sender to this address as a gas payment
    @param _from the sender of the transaction
    @param _to the receipient of the transaction. 
     */
    function _validatePaymentToken(
        address _token,
        address _from,
        address _to,
        bytes calldata _data
    ) internal view {
        bool isSwapModule = _isSwapModule(_to);

        if (isSwapModule) {
            _isValidTokenIn(_token, _data);
        } else if (bytes4(_data[0:4]) == bytes4(0x29451959) && _from == _to) {
            // validation for batch transaction
            // 0x29451959 = BATCH_TX_SELECTOR (see: aa-wallet/libraries/Multicall.sol)
            (, address[] memory targets, bytes[] memory methods, ) = abi.decode(
                _data[4:],
                (bool[], address[], bytes[], uint256[])
            );

            // loop that detects transaction to swapModule and reverts if _token != path[0]
            for (uint256 i; i < targets.length; i++) {
                isSwapModule = _isSwapModule(_to);
                if (isSwapModule) _isValidTokenIn(_token, methods[i]);
            }
        }
    }

    /**
    @notice this is the very function that reverts unless `path[0]` == `_token`
    @param _token the address of the ERC20 token sent from the sender to this address as a gas payment
    @param _data calldata of a transaction in a batched transaction 
     */
    function _isValidTokenIn(address _token, bytes memory _data) internal pure {
        (, address[] memory path) = SwapModuleDecoder.decodeSwapArgs(_data);
        if (path[0] != _token) revert("INVALID_TOKENIN");
    }

    /**
    @notice this function returns true if the callee of the transaction is swapModule contract.
    @param _to the receipient of the transaction. 
     */
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

    /**
    @notice function where those who want to be a paymaster register themselves 
    @notice caller has to deposit funds more than minimam amount
     */
    function registerSponsor() public payable {
        require(msg.value >= minimumETHBalance, "INVALIT_AMOUNT");
        require(!sponsors[msg.sender].isValidSponsor, "ALREADY_VALID");

        sponsors[msg.sender].isValidSponsor = true;
        sponsors[msg.sender].ethBalance = msg.value;
    }

    /**
    @notice function where sponsors enable modules
    @param _modules module addresses that sponsor choose
     */
    function enableSponsoringModules(address[] memory _modules) public {
        Sponsor storage sponsor = sponsors[msg.sender];
        require(sponsor.isValidSponsor, "ALREADY_VALID");

        for (uint256 i = 0; i < _modules.length; i++) {
            sponsor.enabledModules[_modules[i]] = true;
        }
    }

    /**
    @notice function where sponsors disable modules
    @param _modules module addresses that sponsor choose
     */
    function disableSponsoringModules(address[] memory _modules) public {
        Sponsor storage sponsor = sponsors[msg.sender];
        require(sponsor.isValidSponsor, "ALREADY_VALID");

        for (uint256 i = 0; i < _modules.length; i++) {
            require(sponsor.enabledModules[_modules[i]], "NOT_ENABLED");
            sponsor.enabledModules[_modules[i]] = true;
        }
    }

    /// @notice function where sponsors enable Paymaster's GeneralFlow
    function enableGeneralFlow() public {
        Sponsor storage sponsor = sponsors[msg.sender];
        require(sponsor.isValidSponsor, "ALREADY_VALID");
        sponsor.isGeneralFlowSupported = true;
    }

    /// @notice function where sponsors disable Paymaster's GeneralFlow
    function disableGeneralFlow() public {
        Sponsor storage sponsor = sponsors[msg.sender];
        require(sponsor.isValidSponsor, "ALREADY_VALID");
        require(sponsor.isGeneralFlowSupported, "NOT_ENABLED");
        sponsor.isGeneralFlowSupported = false;
    }

    // --- Paymaster's ERC20 Configurations --- //

    /**
    @notice function where sponsor configure acceptance for gas-payment in ERC20 tokens
    @param _token the address of the ERC20 token that sponsor accepts
    @param _maxFee the max amount of eth that sponsor accepts as gas-payment
    @param _minFee the minimum amount of eth that sponsor accepts as gas-payment
    @param _discountRate the rate (from 0 to 1e18) for discount applied to gas-payments in the given ERC20
     */
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

    /**
    @notice function where sponsor diables acceptance for gas-payment in ERC20 tokens
    @param _token the address of the ERC20 token that sponsor accepts
     */
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

    /**
    @notice function where sponsor deposit ETH 
    @notice only registered sponsor can call this method
     */
    function depositETH() public payable returns (uint256) {
        require(_isValidSponsor(msg.sender), "INVALID_SPONSOR");
        sponsors[msg.sender].ethBalance += msg.value;
        return sponsors[msg.sender].ethBalance;
    }

    /**
    @notice function where sponsor withdraw ETH 
    @notice only registered sponsor can call this method
    @dev it calls _withdrawETH in GasPondTokenHelper.sol
     */
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

    /// @notice returns the given sponsor's ETH deposit amount
    function getSponsorETHBalance(address _sponsor)
        public
        view
        returns (uint256)
    {
        return sponsors[_sponsor].ethBalance;
    }

    /// @notice returns the given sponsor's balance of the specified ERC20 token
    function getSponsorERC20Balance(address _sponsor, address _token)
        public
        view
        returns (uint256)
    {
        return sponsors[_sponsor].erc20Balances[_token];
    }

    /// @notice returns the given sponsor's ERC20Payment struct info of the specified ERC20 token
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

    /// @notice returns true if the given sponsor accepts any of the token in the path as gas-payment asset
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

    /// @notice returns true if the given sponsor accepts the specified token as gas-payment asset
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

    // Only callable by registered sponsors for depositing ETH
    receive() external payable {
        depositETH();
    }
}
