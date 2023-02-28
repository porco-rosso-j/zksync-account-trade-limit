pragma solidity ^0.8.0;

library BytesLib {
    function getSelector(bytes memory _data) internal pure returns (bytes4) {
        bytes4 selector;
        assembly {
            selector := calldataload(_data)
        }
        return selector;
    }
}
