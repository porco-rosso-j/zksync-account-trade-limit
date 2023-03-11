//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "zksync-contracts/interfaces/IAccount.sol";
import "zksync-contracts/libraries/SystemContractsCaller.sol";
import "zksync-contracts/libraries/SystemContractHelper.sol";
import "zksync-contracts/libraries/TransactionHelper.sol";
import "zksync-contracts/Constants.sol";
import "zksync-contracts/openzeppelin/utils/Address.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "./libraries/Multicall.sol";
import "./libraries/SignatureHelper.sol";
import "./interfaces/IModule.sol";
import "./interfaces/IModuleManager.sol";

/**
@title Account Abstraction wallet contract
@author Porco Rosso<porcorossoj89@gmail.com>
@notice This is a basic implementation of zkSync's Account Abstraction contract, which offers secure, user-friendly and flexible wallet-experiences.
@notice Unique features: swapmodule with daily trade-size limit, multicall, and meta-transaction for gas-payment in erc20 tokens.
@dev It implements a modulized architecture in which a set of enabled modules provide extensional functionalities to accounts.
@dev For example, swapModule (see: ./modules/swapModule/..)

For more details about zkSync Account Abstraction Support: https://era.zksync.io/docs/dev/developer-guides/aa.html

*/

contract Account is IAccount, IERC1271, IERC165, Multicall {
    using TransactionHelper for Transaction;
    using SignatureHelper for bytes;

    address public owner;
    address public moduleManager;

    bytes4 constant EIP1271_SUCCESS_RETURN_VALUE = 0x1626ba7e;

    /// @dev returns true if the address is an enabled module.
    mapping(address => bool) public isModule;

    /**
     * @dev Simulate the behavior of the EOA if the caller is not the bootloader.
     * Essentially, for all non-bootloader callers halt the execution with empty return data.
     * If all functions will use this modifier AND the contract will implement an empty payable fallback()
     * then the contract will be indistinguishable from the EOA when called.
     */
    modifier ignoreNonBootloader() {
        if (msg.sender != BOOTLOADER_FORMAL_ADDRESS) {
            // If function was called outside of the bootloader, behave like an EOA.
            assembly {
                return(0, 0)
            }
        }
        // Continue execution if called from the bootloader.
        _;
    }

    /**
     * @dev Simulate the behavior of the EOA if it is called via `delegatecall`.
     * Thus, the default account on a delegate call behaves the same as EOA on Ethereum.
     * If all functions will use this modifier AND the contract will implement an empty payable fallback()
     * then the contract will be indistinguishable from the EOA when called.
     */
    modifier ignoreInDelegateCall() {
        address codeAddress = SystemContractHelper.getCodeAddress();
        if (codeAddress != address(this)) {
            // If the function was delegate called, behave like an EOA.
            assembly {
                return(0, 0)
            }
        }

        // Continue execution if not delegate called.
        _;
    }

    /// @dev modifier to block calls from non-account(address(this)) and non-owner address
    modifier onlySelfOrOwner() {
        require(
            msg.sender == address(this) || msg.sender == owner,
            "ONLY_SELF_OR_OWNER"
        );
        _;
    }

    /// @param _owner: single signer of this account contract
    /// @param _moduleManager: AccountFactory contract stores canonical moduleManager address and passes it to accounts at deployment
    constructor(address _owner, address _moduleManager) {
        owner = _owner;
        moduleManager = _moduleManager;
    }

    // ---------------------------------- //
    //          Modules Add/Remove        //
    // ---------------------------------- //

    /// @notice this function enables available modules for the account
    /// @dev fetches module addresses by getModule(moduleId) from moduleManager
    /// @param _moduleIds: arrays of module identification numbers.
    function addModules(uint256[] memory _moduleIds) public onlySelfOrOwner {
        for (uint256 i; i < _moduleIds.length; i++) {
            (address module, address moduleBase) = IModuleManager(moduleManager)
                .getModule(_moduleIds[i]);

            require(!isModule[module], "MODULE_ENABLED");
            IModule(moduleBase).addAccount(address(this));
            isModule[module] = true;
        }
    }

    /// @notice this function disables added modules for the account
    /// @dev fetches module addresses by getModule(moduleId) from moduleManager
    /// @param _moduleIds: arrays of module identification numbers.
    function removeModules(uint256[] memory _moduleIds) public onlySelfOrOwner {
        for (uint256 i; i < _moduleIds.length; i++) {
            (address module, address moduleBase) = IModuleManager(moduleManager)
                .getModule(_moduleIds[i]);

            require(isModule[module], "MODULE_NOT_ENABLED");
            IModule(moduleBase).removeAccount(address(this));
            isModule[module] = false;
        }
    }

    // ---------------------------------- //
    //             Validation             //
    // ---------------------------------- //

    /// @notice Validates the transaction & increments nonce.
    /// @dev The transaction is considered accepted by the account if
    /// the call to this function by the bootloader does not revert
    /// and the nonce has been set as used.
    /// @param _suggestedSignedHash The suggested hash of the transaction to be signed by the user.
    /// This is the hash that is signed by the EOA by default.
    /// @param _transaction The transaction structure itself.
    /// @dev Besides the params above, it also accepts unused first paramter "_txHash", which
    /// is the unique (canonical) hash of the transaction.
    function validateTransaction(
        bytes32,
        bytes32 _suggestedSignedHash,
        Transaction calldata _transaction
    )
        external
        payable
        override
        ignoreNonBootloader
        ignoreInDelegateCall
        returns (bytes4 magic)
    {
        return _validateTransaction(_suggestedSignedHash, _transaction);
    }

    /// @notice Inner method for validating transaction and increasing the nonce
    /// @param _suggestedSignedHash The hash of the transaction signed by the EOA
    /// @param _transaction The transaction.
    /// @return magic The bytes4 value that is ACCOUNT_VALIDATION_SUCCESS_MAGIC if valid
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

    /// @dev Should return whether the signature provided is valid for the provided data
    /// @param _hash The hash of the transaction to be signed.
    /// @param _signature The signature of the transaction.
    /// @return magic The bytes4 value that is ACCOUNT_VALIDATION_SUCCESS_MAGIC if valid
    function isValidSignature(bytes32 _hash, bytes calldata _signature)
        public
        view
        override
        returns (bytes4 magic)
    {
        magic = EIP1271_SUCCESS_RETURN_VALUE;

        bytes memory signature = SignatureHelper.extractECDSASignature(
            _signature
        );

        if (!SignatureHelper.checkValidECDSASignatureFormat(signature)) {
            magic = bytes4(0);
        }

        address recoveredAddr = ECDSA.recover(_hash, signature);

        if (recoveredAddr != owner) {
            magic = bytes4(0);
        }
    }

    // ---------------------------------- //
    //             Executions             //
    // ---------------------------------- //

    /// @notice Method called by the bootloader to execute the transaction.
    /// @param _transaction The transaction to execute.
    /// @dev It also accepts unused _txHash and _suggestedSignedHash parameters:
    /// the unique (canonical) hash of the transaction and the suggested signed
    /// hash of the transaction.
    function executeTransaction(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    ) external payable override ignoreNonBootloader ignoreInDelegateCall {
        _executeTransaction(_transaction);
    }

    /// @notice Inner method for executing a transaction.
    /// @param _transaction The transaction to execute.
    /// @dev it executes multicall if isBatched returns true and delegatecalls if _transaction.to is a module
    function _executeTransaction(Transaction calldata _transaction) internal {
        address to = address(uint160(_transaction.to));
        uint256 value = _transaction.value;
        bytes memory data = _transaction.data;

        if (isBatched(_transaction.data, to)) {
            multicall(_transaction.data[4:]);
        } else if (isModule[to]) {
            Address.functionDelegateCall(to, data);
        } else {
            Address.functionCallWithValue(to, data, value);
        }
    }

    /// @notice Method that should be used to initiate a transaction from this account
    /// by an external call. This is not mandatory but should be implemented so that
    /// it is always possible to execute transactions from L1 for this account.
    /// @dev This method is basically validate + execute.
    /// @param _transaction The transaction to execute.
    function executeTransactionFromOutside(Transaction calldata _transaction)
        external
        payable
        override
        ignoreNonBootloader
        ignoreInDelegateCall
    {
        _validateTransaction(bytes32(0), _transaction);
        _executeTransaction(_transaction);
    }

    // ---------------------------------- //
    //               Others               //
    // ---------------------------------- //

    /// @notice Method for paying the bootloader for the transaction.
    /// @param _transaction The transaction for which the fee is paid.
    /// @dev It also accepts unused _txHash and _suggestedSignedHash parameters:
    /// the unique (canonical) hash of the transaction and the suggested signed
    /// hash of the transaction.
    function payForTransaction(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    ) external payable override ignoreNonBootloader ignoreInDelegateCall {
        bool success = _transaction.payToTheBootloader();
        require(success, "Failed to pay the fee to the operator");
    }

    /// @notice Method, where the user should prepare for the transaction to be
    /// paid for by a paymaster.
    /// @dev Here, the account should set the allowance for the smart contracts
    /// @param _transaction The transaction.
    /// @dev It also accepts unused _txHash and _suggestedSignedHash parameters:
    /// the unique (canonical) hash of the transaction and the suggested signed
    /// hash of the transaction.
    function prepareForPaymaster(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    ) external payable override ignoreNonBootloader ignoreInDelegateCall {
        _transaction.processPaymasterInput();
    }

    /// @notice method to prove that this contract inherits IAccount interface, called
    /// @param interfaceId identifier unique to each interface
    /// @return true if this contract implements the interface defined by `interfaceId`
    /// Details: https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[EIP section]
    /// This function call must use less than 30 000 gas
    function supportsInterface(bytes4 interfaceId)
        external
        pure
        returns (bool)
    {
        return interfaceId == type(IAccount).interfaceId;
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
