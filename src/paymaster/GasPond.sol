pragma solidity 0.8.11;

import {IPaymaster, ExecutionResult} from "zksync-contracts/interfaces/IPaymaster.sol";
import {IPaymasterFlow} from "zksync-contracts/interfaces/IPaymasterFlow.sol";
import {TransactionHelper, Transaction} from "zksync-contracts/libraries/TransactionHelper.sol";
import {BOOTLOADER_FORMAL_ADDRESS} from "zksync-contracts/Constants.sol";
import {IERC20} from "zksync-contracts/openzeppelin/token/ERC20/IERC20.sol";

import {BytesLib} from "./lib/BytesLib.sol";
import {GasPondStorage} from "./GasPondStorage.sol";
import {ERC20PaymentHelper} from "./utils/ERC20PaymentHelper.sol";

contract GasPond is IPaymaster, GasPondStorage, ERC20PaymentHelper {
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
        ERC20PaymentHelper(_weth, _swapRouter)
    {
        owner = msg.sender;
    }

    // ================================================================= //
    //                        Paymaster Operatiosn                       //
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

        _contractValidations(
            _transaction.data,
            address(uint160(_transaction.to))
        );

        uint256 eth_fee = _transaction.gasLimit * _transaction.maxFeePerGas;

        if (paymasterInputSelector == IPaymasterFlow.approvalBased.selector) {
            _approvalBasedFlow(_transaction);
        } else if (paymasterInputSelector == IPaymasterFlow.general.selector) {
            _assetOwnershipValidations(address(uint160(_transaction.from)));
        } else {
            revert("Unsupported paymaster flow");
        }

        _limitValidation(
            eth_fee,
            _transaction.gasLimit,
            _transaction.maxFeePerGas
        );

        payErgs(eth_fee);
    }

    function payErgs(uint256 _eth_fee) internal {
        (bool success, ) = payable(BOOTLOADER_FORMAL_ADDRESS).call{
            value: _eth_fee
        }("");
        require(success, "gas payment failed");
    }

    function _approvalBasedFlow(Transaction calldata _transaction) internal {
        (address token, uint256 allowance, ) = abi.decode(
            _transaction.paymasterInput[4:],
            (address, uint256, bytes)
        );

        require(token != address(0), "Address Zero");
        require(allowance != 0, "Allowance Zero");

        ERC20PaymentInfo memory erc20payment = erc20payments[token];
        require(erc20payment.isEnabled, "Invalid Token");
        require(erc20payment.minFee <= allowance, "Invalid Allowance");

        (uint256 token_fee, uint256 eth_fee) = _calcuFees(
            _transaction.gasLimit,
            _transaction.maxFeePerGas,
            token
        );

        if (erc20payment.discountRate != 0) {
            token_fee =
                (token_fee * erc20payment.discountRate) /
                DECIMAL_PRECISION;
        }

        _payInERC20(token, token_fee, address(uint160(_transaction.from)));
    }

    function _contractValidations(bytes memory _data, address _to) internal {
        if (isContractBasedValidationEnabled) {
            require(isValidContract[_to], "Invalid Contract");

            if (isFunctionBasedValidationEnabled) {
                bytes4 selector = BytesLib.getSelector(_data);
                require(isValidFunction[selector], "Invalid Function");
            }
        }

        return;
    }

    // if enabled, holders of certain assets like a governance token or a NFT
    // can be entitiled for being sponsored.
    // e.g. 1000 xSUSHI holder can transact for free on Sushiswap.
    function _assetOwnershipValidations(address _from) internal {
        if (ownership.isEnabled) {
            uint256 balance = IERC20(ownership.asset).balanceOf(_from);
            require(balance >= ownership.minOwnership, "Invalid Holdings");
        }
        return;
    }

    function _limitValidation(
        uint256 _eth_fee,
        uint256 _maxGas,
        uint256 _maxFeePerGas
    ) internal {
        if (!limit.isEnabled) return;

        require(
            limit.maxGas <= _maxGas && limit.maxFeePerGas <= _maxFeePerGas,
            "Invalid Gas"
        );

        uint256 timestamp = block.timestamp;

        if (limit.limit != limit.available && timestamp > limit.resetTime) {
            limit.resetTime = timestamp + limit.duration;
            limit.available = limit.limit;
        } else if (limit.limit == limit.available) {
            limit.resetTime = timestamp + limit.duration;
        }

        // reverts if the amount exceeds the remaining available amount.
        require(limit.available >= _eth_fee, "Exceed limit");

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
    //                        Client Operations                          //
    // ================================================================= //

    function registerCompensation() public {}

    function _depositETH() internal {}

    function _withdrawETH() internal {}

    function _withdrawToken() internal {}

    // addSonsorableOwnership()

    function addERC20Payment(
        address _token,
        uint256 _amount,
        uint256 _discountRate
    ) public onlyOwner {
        erc20payments[_token].minFee = _amount;
        erc20payments[_token].discountRate = _discountRate;
        erc20payments[_token].isEnabled = true;
    }

    function removeERC20Payment(address _token) public onlyOwner {
        erc20payments[_token].minFee = 0;
        erc20payments[_token].discountRate = 0;
        erc20payments[_token].isEnabled = false;
    }

    function setMinTokenFee(address _token, uint256 _amount) public onlyOwner {
        require(_amount != 0, "INVALID_AMOUNT");
        erc20payments[_token].minFee = _amount;
    }

    function setDiscountRate(address _token, uint256 _discountRate)
        public
        onlyOwner
    {
        require(_discountRate != 0, "INVALID_AMOUNT");
        erc20payments[_token].discountRate = _discountRate;
    }

    receive() external payable {}
}
