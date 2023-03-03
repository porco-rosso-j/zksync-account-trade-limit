pragma solidity ^0.8.0;

import "zksync-contracts/openzeppelin/utils/Address.sol";

contract Multicall {
    // keccak256(executeMultiDelegateicall(bytes memory))
    bytes4 public constant BATCH_TX_SELECTOR = 0x29451959;

    function isBatched(bytes calldata _data, address _to)
        internal
        view
        returns (bool)
    {
        bytes4 selector = bytes4(_data[0:4]);
        return selector == BATCH_TX_SELECTOR && _to == address(this);
    }

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
