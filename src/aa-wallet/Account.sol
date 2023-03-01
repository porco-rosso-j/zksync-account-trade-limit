pragma solidity ^0.8.0;

import "zksync-contracts/interfaces/IAccount.sol";
import "zksync-contracts/libraries/SystemContractsCaller.sol";
import "zksync-contracts/libraries/TransactionHelper.sol";
import "zksync-contracts/Constants.sol";
import "zksync-contracts/openzeppelin/utils/Address.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "./libraries/Multisend.sol";
import "./libraries/SignatureHelper.sol";
import "./interfaces/IModule.sol";

contract Account is IAccount, IERC1271, Multisend {
    using TransactionHelper for Transaction;
    using SignatureHelper for bytes;

    address public owner;
    bytes4 constant EIP1271_SUCCESS_RETURN_VALUE = 0x1626ba7e;

    mapping(address => bool) public modules;

    modifier onlyBootloader() {
        require(msg.sender == BOOTLOADER_FORMAL_ADDRESS, "ONLY_BOOTOADER");
        _;
    }

    modifier onlySelf() {
        require(msg.sender == address(this), "ONLY_SELF");
        _;
    }

    constructor(address _owner) {
        owner = _owner;
    }

    // ---------------------------------- //
    //               Modules              //
    // ---------------------------------- //

    function addModule(address _module, address _moduleBase) public onlySelf {
        require(!modules[_module], "MODULE_ENABLED");
        modules[_module] = true;
        IModule(_moduleBase).addAccount(address(this));
    }

    // ---------------------------------- //
    //             Validation             //
    // ---------------------------------- //

    function validateTransaction(
        bytes32,
        bytes32 _suggestedSignedHash,
        Transaction calldata _transaction
    ) external payable override onlyBootloader returns (bytes4 magic) {
        return _validateTransaction(_suggestedSignedHash, _transaction);
    }

    function _validateTransaction(
        bytes32 _suggestedSignedHash,
        Transaction calldata _transaction
    ) internal returns (bytes4 magic) {
        SystemContractsCaller.systemCallWithPropagatedRevert(
            uint32(gasleft()),
            address(NONCE_HOLDER_SYSTEM_CONTRACT),
            0,
            abi.encodeCall(
                INonceHolder(NONCE_HOLDER_SYSTEM_CONTRACT)
                    .incrementMinNonceIfEquals,
                (_transaction.nonce)
            )
        );

        bytes32 txHash = _suggestedSignedHash == bytes32(0)
            ? _transaction.encodeHash()
            : _suggestedSignedHash;

        uint256 totalRequiredBalance = _transaction.totalRequiredBalance();
        require(
            totalRequiredBalance <= address(this).balance,
            "Not enough balance for fee + value"
        );

        if (
            isValidSignature(txHash, _transaction.signature) ==
            EIP1271_SUCCESS_RETURN_VALUE
        ) {
            magic = ACCOUNT_VALIDATION_SUCCESS_MAGIC;
        } else {
            magic = bytes4(0);
        }
    }

    function isValidSignature(bytes32 _hash, bytes calldata _signature)
        public
        view
        override
        returns (bytes4 magic)
    {
        magic = EIP1271_SUCCESS_RETURN_VALUE;

        // if (_signature.length != 65) {
        //     _signature = new bytes(65);
        //     _signature[64] = bytes1(uint8(27));
        // }

        // bytes memory signature = SignatureHelper.extractECDSASignature(
        //     _signature
        // );

        if (!SignatureHelper.checkValidECDSASignatureFormat(_signature)) {
            magic = bytes4(0);
        }

        address recoveredAddr = ECDSA.recover(_hash, _signature);

        if (recoveredAddr != owner) {
            magic = bytes4(0);
        }
    }

    // ---------------------------------- //
    //             Executions             //
    // ---------------------------------- //

    function executeTransaction(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    ) external payable override onlyBootloader {
        _executeTransaction(_transaction);
    }

    function _executeTransaction(Transaction calldata _transaction) internal {
        address to = address(uint160(_transaction.to));
        uint256 value = _transaction.value;
        bytes memory data = _transaction.data;

        if (modules[to] && value == 0) {
            Address.functionDelegateCall(to, data);
        } else {
            Address.functionCallWithValue(to, data, value);
        }
    }

    //  delegatecall: proxy -> account
    //　delegatecall: account -> swapmodule
    //  call: swapmodule -> uniswap
    //https://github.com/safe-global/safe-contracts/blob/96a4e280876c33c53a09b5ef6ee78201a101ff58/contracts/libraries/MultiSend.sol
    //https://github.com/Instadapp/dsa-contracts/blob/42be5280b23b986a3beb55aeab2df9466fd84134/contracts/v2/accounts/test/ImplementationBetaTest.sol

    function executeTransactionFromOutside(Transaction calldata _transaction)
        external
        payable
    {
        _validateTransaction(bytes32(0), _transaction);
        _executeTransaction(_transaction);
    }

    // ---------------------------------- //
    //               Others               //
    // ---------------------------------- //

    function payForTransaction(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    ) external payable override onlyBootloader {
        bool success = _transaction.payToTheBootloader();
        require(success, "Failed to pay the fee to the operator");
    }

    function prepareForPaymaster(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    ) external payable override onlyBootloader {
        _transaction.processPaymasterInput();
    }

    fallback() external {
        // fallback of default account shouldn't be called by bootloader under no circumstances
        assert(msg.sender != BOOTLOADER_FORMAL_ADDRESS);

        // If the contract is called directly, behave like an EOA
    }

    receive() external payable {
        // If the contract is called directly, behave like an EOA.
        // Note, that is okay if the bootloader sends funds with no calldata as it may be used for refunds/operator payments
    }
}
