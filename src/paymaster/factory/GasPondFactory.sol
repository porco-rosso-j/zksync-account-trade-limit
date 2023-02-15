//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.11;

import "zksync-contracts/Constants.sol";
import "zksync-contracts/libraries/SystemContractsCaller.sol";
import "./GasPondFactoryStorage.sol";

contract GasPondFactory {
    bytes32 public BytecodeHash;
    GasPondFactoryStorage paymasterStorage;

    /**
     * @notice creates new instance of paymasterStorage at factory creation time (see IPaymasterStorage.sol)
     */
    constructor(bytes32 _bytecodeHash) {
        BytecodeHash = _bytecodeHash;
        paymasterStorage = new GasPondFactoryStorage();
    }

    /**
     * @notice This function uses Create2 to deploy a paymaster contract
     * @dev uses SystemcontractCaller makes a call to the DEPLOYER_SYSTEM_CONTRACT and deploys paymaster contract with bytecode (BytecodeHash).
     * @param _salt - create2 salt
     * @param _owner - deployer address or whomever will be assumed paymaster owner
     * @param _metadata - metadata to be passed to PaymasterStorage
     * @param _weth -
     * @param _swapRouter -
     */
    function deployPaymaster(
        // used in create2
        bytes32 _salt,
        address _owner,
        bytes memory _metadata,
        address _weth,
        address _swapRouter
    ) external returns (address accountAddress) {
        bytes memory returnData = SystemContractsCaller
            .systemCallWithPropagatedRevert(
                uint32(gasleft()),
                address(DEPLOYER_SYSTEM_CONTRACT),
                0,
                abi.encodeCall(
                    DEPLOYER_SYSTEM_CONTRACT.create2,
                    (
                        _salt,
                        BytecodeHash,
                        abi.encode(_owner, _weth, _swapRouter)
                    )
                )
            );

        (accountAddress, ) = abi.decode(returnData, (address, bytes));
        storePaymaster(_owner, accountAddress, _metadata);
    }

    function storePaymaster(
        address owner,
        address paymasterAddr,
        bytes memory metadata
    ) internal {
        paymasterStorage.storePaymaster(owner, paymasterAddr, metadata);
    }

    function getStorageAddress() public view returns (address) {
        return address(paymasterStorage);
    }
}
