pragma solidity ^0.8.0;

import "zksync-contracts/Constants.sol";
import "zksync-contracts/libraries/SystemContractsCaller.sol";
import "./interfaces/IAccountRegistry.sol";

contract AccountFactory {
    bytes32 public accountBytecodeHash;
    address public moduleManager;
    address public accountRegistry;

    constructor(
        bytes32 _accountBytecodeHash,
        address _moduleManager,
        address _accountRegistry
    ) {
        accountBytecodeHash = _accountBytecodeHash;
        moduleManager = _moduleManager;
        accountRegistry = _accountRegistry;
    }

    function deployAccount(bytes32 salt, address owner)
        external
        returns (address accountAddress)
    {
        (bool success, bytes memory returnData) = SystemContractsCaller
            .systemCallWithReturndata(
                uint32(gasleft()),
                address(DEPLOYER_SYSTEM_CONTRACT),
                uint128(0),
                abi.encodeCall(
                    DEPLOYER_SYSTEM_CONTRACT.create2Account,
                    (
                        salt,
                        accountBytecodeHash,
                        abi.encode(owner, moduleManager),
                        IContractDeployer.AccountAbstractionVersion.Version1
                    )
                )
            );
        require(success, "Deployment Failed");
        accountAddress = abi.decode(returnData, (address));

        IAccountRegistry(accountRegistry)._storeAccount(accountAddress);
    }
}
