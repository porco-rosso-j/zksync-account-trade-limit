//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.11;

import {IPaymaster, ExecutionResult} from "zksync-contracts/interfaces/IPaymaster.sol";
import {IPaymasterFlow} from "zksync-contracts/interfaces/IPaymasterFlow.sol";
import {TransactionHelper, Transaction} from "zksync-contracts/libraries/TransactionHelper.sol";
import {BOOTLOADER_FORMAL_ADDRESS} from "zksync-contracts/Constants.sol";
import {IERC20} from "zksync-contracts/openzeppelin/token/ERC20/IERC20.sol";

import {BytesLib} from "./lib/BytesLib.sol";
import {GasPondStorage} from "./GasPondStorage.sol";
import {GasPondTokenHelper} from "./GasPondTokenHelper.sol";

contract GasPond is IPaymaster, GasPondStorage, GasPondTokenHelper {
    using TransactionHelper for Transaction;
    using BytesLib for bytes;

    modifier onlyBootloader() {
        require(
            msg.sender == BOOTLOADER_FORMAL_ADDRESS,
            "Only bootloader can call this method"
        );
        // Continue execution if called from the bootloader.
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner is allowed");
        _;
    }

    constructor(address _weth, address _swapRouter)
        GasPondTokenHelper(_weth, _swapRouter)
    {
        owner = msg.sender;
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
        returns (bytes4 magic, bytes memory context)
    {
        require(
            _transaction.paymasterInput.length >= 4,
            "The standard paymaster input must be at least 4 bytes long"
        );

        bytes4 paymasterInputSelector = bytes4(
            _transaction.paymasterInput[0:4]
        );

        _validateContract(_transaction.data, address(uint160(_transaction.to)));

        uint256 eth_fee = _transaction.gasLimit * _transaction.maxFeePerGas;

        if (paymasterInputSelector == IPaymasterFlow.approvalBased.selector) {
            _approvalBasedFlow(_transaction, eth_fee);
        } else if (paymasterInputSelector == IPaymasterFlow.general.selector) {
            _validateOwnership(address(uint160(_transaction.from)));
        } else {
            revert("Unsupported paymaster flow");
        }

        _validateLimit(
            eth_fee,
            _transaction.gasLimit,
            _transaction.maxFeePerGas
        );

        _payErgs(eth_fee);
    }

    function _payErgs(uint256 _eth_fee) internal {
        (bool success, ) = payable(BOOTLOADER_FORMAL_ADDRESS).call{
            value: _eth_fee
        }("");
        require(success, "gas payment failed");
    }

    function _approvalBasedFlow(
        Transaction calldata _transaction,
        uint256 _eth_fee
    ) internal {
        (address token, uint256 allowance, ) = abi.decode(
            _transaction.paymasterInput[4:],
            (address, uint256, bytes)
        );

        ERC20PaymentInfo memory erc20payment = erc20payments[token];
        require(erc20payment.isEnabled, "INVALID_TOKEN");
        require(erc20payment.minFee <= allowance, "INVALID_ALLOWANCE");

        uint256 token_fee = _getTokenFee(token, _eth_fee);

        require(erc20payment.maxFee >= token_fee, "EXCEED_MAXFEE");

        if (erc20payment.discountRate != 0) {
            token_fee =
                (token_fee * erc20payment.discountRate) /
                DECIMAL_PRECISION;
        }

        _payInERC20(token, token_fee, address(uint160(_transaction.from)));
    }

    function _validateContract(bytes memory _data, address _to) internal view {
        if (contracts.isSponsoringEnabled) {
            require(contracts.isValidContract[_to], "Invalid Contract");

            if (contracts.isFunctionSponsoringEnabled) {
                bytes4 selector = BytesLib.getSelector(_data);
                require(
                    contracts.isValidFunction[selector],
                    "Invalid Function"
                );
            }
        }

        return;
    }

    // if enabled, holders of certain assets like a governance token or a NFT
    // can be entitiled for being sponsored.
    // e.g. 1000 xSUSHI holder can transact for free on Sushiswap.
    function _validateOwnership(address _from) internal view {
        if (ownership.isEnabled) {
            uint256 balance = IERC20(ownership.asset).balanceOf(_from);
            require(balance >= ownership.minOwnership, "Invalid Holdings");
        }
        return;
    }

    function _validateLimit(
        uint256 _eth_fee,
        uint256 _maxGas,
        uint256 _maxFeePerGas
    ) internal {
        if (!limit.isEnabled) return;

        require(
            limit.maxGas <= _maxGas && limit.maxFeePerGas <= _maxFeePerGas,
            "INVALID_GAS"
        );

        uint256 timestamp = block.timestamp;

        if (limit.limit != limit.available && timestamp > limit.resetTime) {
            limit.resetTime = timestamp + limit.duration;
            limit.available = limit.limit;
        } else if (limit.limit == limit.available) {
            limit.resetTime = timestamp + limit.duration;
        }

        // reverts if the amount exceeds the remaining available amount.
        require(limit.available >= _eth_fee, "EXCEED_LIMIT");

        // decrement `available`
        limit.available -= _eth_fee;
    }

    function postTransaction(
        bytes calldata _context,
        Transaction calldata _transaction,
        bytes32 _txHash,
        bytes32 _suggestedSignedHash,
        ExecutionResult _txResult,
        uint256 _maxRefundedErgs
    ) external payable override onlyBootloader {
        // this contract doesnt support any refund logic tho
    }

    // ================================================================= //
    //                        Paymaster Operations                          //
    // ================================================================= //

    // --- Paymaster's Limit Configurations --- //

    function setLimit(
        uint256 _limit,
        uint256 _duration,
        uint256 _maxFeePerGas,
        uint256 _maxGas
    ) public onlyOwner {
        require(_limit != 0, "INVALID_AMOUNT");
        require(_duration != 0, "INVALID_AMOUNT");
        require(_maxFeePerGas != 0, "INVALID_AMOUNT");
        require(_maxGas != 0, "INVALID_AMOUNT");

        limit = Limit(
            _limit,
            _limit,
            _duration,
            0,
            _maxFeePerGas,
            _maxGas,
            true
        );
    }

    function removeLimit() public onlyOwner {
        require(limit.isEnabled, "LIMIT_NOT_ENABLED");
        limit = Limit(0, 0, 0, 0, 0, 0, false);
    }

    // --- Paymaster's Sponcoring Configurations --- //

    function setSponcorableOwnership(address _asset, uint256 _minOwnership)
        public
        onlyOwner
    {
        require(_asset != address(0), "INVALID_ASSET");
        require(_minOwnership >= 1, "INVALID_AMOUNT");
        ownership = SponcorableOwnership(_asset, _minOwnership, true);
    }

    function removeSponcorableOwnership() public onlyOwner {
        require(ownership.isEnabled, "ALREADY_ENABLED");
        ownership = SponcorableOwnership(address(0), 0, false);
    }

    // --- Paymaster's ERC20 Configurations --- //

    function setERC20PaymentInfo(
        address _token,
        uint256 _maxFee,
        uint256 _minFee,
        uint256 _discountRate
    ) public onlyOwner {
        require(_token != address(0), "INVALID_TOKEN");
        require(_maxFee != 0, "INVALID_AMOUNT");
        require(_minFee != 0, "INVALID_AMOUNT");
        require(_discountRate != 0 && _discountRate <= 1e18, "INVALID_AMOUNT");
        erc20payments[_token].maxFee = _maxFee;
        erc20payments[_token].minFee = _minFee;
        erc20payments[_token].discountRate = _discountRate;
        erc20payments[_token].isEnabled = true;
    }

    function removeERC20PaymentInfo(address _token) public onlyOwner {
        require(!erc20payments[_token].isEnabled, "NOT_ENABLED");
        erc20payments[_token].maxFee = 0;
        erc20payments[_token].minFee = 0;
        erc20payments[_token].discountRate = 0;
        erc20payments[_token].isEnabled = false;
    }

    function setMaxAndMinTokenFee(
        address _token,
        uint256 _maxFee,
        uint256 _minFee
    ) public onlyOwner {
        require(_token != address(0), "INVALID_TOKEN");
        require(_maxFee != 0, "INVALID_AMOUNT");
        require(_minFee != 0, "INVALID_AMOUNT");
        erc20payments[_token].minFee = _minFee;
    }

    function setDiscountRate(address _token, uint256 _discountRate)
        public
        onlyOwner
    {
        require(_token != address(0), "INVALID_TOKEN");
        require(_discountRate != 0, "INVALID_AMOUNT");
        erc20payments[_token].discountRate = _discountRate;
    }

    // --- Paymaster's Contract&Function Configurations --- //

    function enableSponsoringContract() public onlyOwner {
        require(!contracts.isSponsoringEnabled, "ALREADY_ENABLED");
        contracts.isSponsoringEnabled = true;
    }

    function disableSponsoringContract() public onlyOwner {
        require(contracts.isSponsoringEnabled, "NOT_ENABLED");
        contracts.isSponsoringEnabled = false;
    }

    function setSponsoredContract(address[] memory _contracts)
        public
        onlyOwner
    {
        for (uint256 i = 0; i < _contracts.length; i++) {
            address targetContract = _contracts[i];
            require(targetContract != address(0), "INVALID_ADDRESS");
            if (!contracts.isValidContract[targetContract]) {
                contracts.isValidContract[targetContract] = true;
            }
        }
    }

    function removeSponsoredContract(address _contract) public onlyOwner {
        require(contracts.isSponsoringEnabled, "NOT_ENABLED");
        require(contracts.isValidContract[_contract], "NOT_VALID");
        contracts.isValidContract[_contract] = false;
    }

    function enableSponsoringFunction() public onlyOwner {
        require(contracts.isSponsoringEnabled, "NOT_ENABLED");
        require(!contracts.isFunctionSponsoringEnabled, "ALREADY_ENABLED");
        contracts.isFunctionSponsoringEnabled = true;
    }

    function disableSponsoringFunction() public onlyOwner {
        require(contracts.isFunctionSponsoringEnabled, "NOT_ENABLED");
        contracts.isFunctionSponsoringEnabled = false;
    }

    function setSponsoredFunction(bytes4[] memory _selectors) public onlyOwner {
        require(contracts.isSponsoringEnabled, "NOT_ENABLED");
        require(contracts.isFunctionSponsoringEnabled, "NOT_ENABLED");

        for (uint256 i = 0; i < _selectors.length; i++) {
            bytes4 selector = _selectors[i];
            require(selector != bytes4(0), "INVALID_BYTE");
            contracts.isValidFunction[selector] = true;
        }
    }

    function removeSponsoredFucntion(bytes4 _selector) public onlyOwner {
        require(contracts.isSponsoringEnabled, "NOT_ENABLED");
        require(contracts.isFunctionSponsoringEnabled, "NOT_ENABLED");
        require(!contracts.isValidFunction[_selector]);
        contracts.isValidFunction[_selector] = false;
    }

    // --- Paymaster's token Operations --- //

    function withdrawETH(uint256 _amount) public onlyOwner {
        require(_amount != 0, "INVALID_AMOUNT");
        _withdrawETH(_amount);
    }

    function withdrawToken(address _token, uint256 _amount) public onlyOwner {
        require(erc20payments[_token].isEnabled, "INVALID_TOKEN");
        require(_amount != 0, "INVALID_AMOUNT");
        uint256 balance = IERC20(_token).balanceOf(address(this));
        require(balance != 0, "NO_BALANCE");
        _withdrawToken(_token, _amount);
    }

    function swapTokensForETH(
        address[] memory _tokens,
        uint256[] memory _amounts
    ) public onlyOwner {
        require(
            _tokens.length == _amounts.length && _tokens.length != 0,
            "INVALID_LENDGTH"
        );
        for (uint256 i = 0; i < _tokens.length; i++) {
            swapTokenForETH(_tokens[i], _amounts[i]);
        }
    }

    function swapTokenForETH(address _token, uint256 _amount) public onlyOwner {
        require(_token != address(0), "INVALID_ADDRESS");
        require(_amount != 0, "INVALID_AMOUNT");

        _swapERC20ForETH(_token, _amount);
    }

    receive() external payable {
        require(msg.sender == owner, "INVALID_SENDER");
    }
}
