pragma solidity ^0.8.0;

import "./BytesLib.sol";

contract Multisend {
    using BytesLib for bytes;

    enum Operation {
        Call,
        Delegatecall
    }

    // keccak256(_executeBatchTransaction(bytes memory))
    // should be like keccak256(executeBatchTransaction(bytes memory)) instead "non-existent func tho"
    // bytes4 public constant BATCH_TX_SELECTOR1 = 0x7c3068b5;
    // bytes4 public constant BATCH_TX_SELECTOR2 = 0x7c3068b5;

    // function isBatched(bytes memory _data) internal pure returns (bool) {
    //     bytes4 selector = BytesLib.getSelector(_data);
    //     return selector == BATCH_TX_SELECTOR1 || BATCH_TX_SELECTOR1;
    //     if (selector == (BATCH_TX_SELECTOR1 || BATCH_TX_SELECTOR1)) {
    //         return true;
    //     }
    // }

    function executeMulticall(bytes memory _data) public {
        (
            address[] memory targets,
            bytes[] memory methods,
            uint256[] memory values
        ) = _decodeBatchData(Operation.Call, _data);

        address to;
        bytes memory data;
        uint256 value;

        for (uint256 i = 0; i < targets.length; i++) {
            to = targets[i];
            data = methods[i];
            value = values[i];

            bool success;

            assembly {
                success := call(
                    gas(),
                    to,
                    value,
                    add(data, 0x20),
                    mload(data),
                    0,
                    0
                )
            }

            require(success);
        }
    }

    function executeMultDelegateicall(bytes memory _data) public {
        (address[] memory targets, bytes[] memory methods, ) = _decodeBatchData(
            Operation.Delegatecall,
            _data
        );

        address to;
        bytes memory data;

        for (uint256 i = 0; i < targets.length; i++) {
            to = targets[i];
            data = methods[i];

            uint256 ret;
            bool success;

            assembly {
                let output := mload(0x40)
                success := delegatecall(
                    gas(),
                    to,
                    add(data, 32),
                    mload(data),
                    output,
                    0x20
                )
                ret := mload(output)
            }

            require(success);
        }
    }

    //https://ethereum.stackexchange.com/questions/86581/in-assembly-cant-get-delegatecall-to-work

    function _decodeBatchData(Operation _operation, bytes memory _data)
        internal
        pure
        returns (
            address[] memory targets,
            bytes[] memory methods,
            uint256[] memory values
        )
    {
        if (_operation == Operation.Call) {
            (, targets, methods, values) = abi.decode(
                _data,
                (bytes4, address[], bytes[], uint256[])
            );
            return (targets, methods, values);
        } else {
            (, targets, methods) = abi.decode(
                _data,
                (bytes4, address[], bytes[])
            );
            return (targets, methods, new uint256[](0));
        }
    }
}
