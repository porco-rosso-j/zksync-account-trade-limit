//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "zksync-contracts/openzeppelin/utils/Address.sol";

/**
@title Multicall Contract that allows Account to execute delegatecall 
@author Porco Rosso<porcorossoj89@gmail.com>

@dev How to call multicall: 
Transaction that intends to perform multicall configrues the transaction struct like the following...
- sets callee as account address itself.
- put BATCH_TX_SELECTOR which is 0x29451959 into the first 4bytes of tx calldata ( or tx selector or msg.sig, you name it! )
- concat the bytes4 value with an batched and encoded calldata like the ts script below

    const isDelegatecalls[]   // contain boolean value about whether it is delegatecall or not
    const targets[]           // contain target addresses
    const methods[]           // contain method bytes 
    const values[]            // contain value (msg.value)

    ・・・

    // encode each array into a hexilified calldata
    const AbiCoder = new ethers.utils.AbiCoder()
    const batchData = AbiCoder.encode(["bool[]", "address[]", "bytes[]", "uint[]"], [isDelegatecalls, targets, methods, values])

    // oncat BATCH_SELECTOR with the hex calldata after removing the first two letters: "0x"
    BATCH_SELECTOR.concat(batchedCalldata.replace("0x", ""))

    For more info: see constructBatchedCalldata() method in frontend/src/commmon/swapModule.ts in this repo
*/

contract Multicall {
    // bytes4(keccak256(multicall(bytes memory)))
    bytes4 public constant BATCH_TX_SELECTOR = 0x29451959;

    /// @notice view function to return true if the transaction's function selector matches BATCH_TX_SELECTOR
    function isBatched(bytes calldata _data, address _to)
        internal
        view
        returns (bool)
    {
        bytes4 selector = bytes4(_data[0:4]);
        return selector == BATCH_TX_SELECTOR && _to == address(this);
    }

    /**
    @notice method to execute multicall
    @param _data batched calldata
    @dev _data == _transaction.data[4:] which removes the first 4 bytes from the _transaction.data
    @dev this function can perform both basic call and delegatecall in the same batch transaction 
         because of provided boolean valu e`isDelegatecall`
     */
    function multicall(bytes memory _data) public {
        (
            bool[] memory isDelegatecall,
            address[] memory targets,
            bytes[] memory methods,
            uint256[] memory values
        ) = _decodeBatchData(_data);

        address to;
        bytes memory data;
        uint256 value;

        for (uint256 i = 0; i < targets.length; i++) {
            to = targets[i];
            data = methods[i];
            value = values[i];

            if (isDelegatecall[i]) {
                Address.functionDelegateCall(to, data);
            } else {
                Address.functionCallWithValue(to, data, value);
            }
        }
    }

    function _decodeBatchData(bytes memory _data)
        internal
        pure
        returns (
            bool[] memory isDelegatecall,
            address[] memory targets,
            bytes[] memory methods,
            uint256[] memory values
        )
    {
        (isDelegatecall, targets, methods, values) = abi.decode(
            _data,
            (bool[], address[], bytes[], uint256[])
        );
        return (isDelegatecall, targets, methods, values);
    }
}
