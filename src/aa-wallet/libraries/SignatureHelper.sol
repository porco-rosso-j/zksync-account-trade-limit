//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

/**

These two functions are taken from the tutorial of AA-multisig wallet on zkSync developer doc.
see: https://era.zksync.io/docs/dev/tutorials/custom-aa-tutorial.html#signature-validation

*/

library SignatureHelper {
    function extractECDSASignature(bytes memory _signature)
        internal
        pure
        returns (bytes memory signature)
    {
        require(_signature.length == 65, "Invalid length");

        signature = new bytes(65);

        assembly {
            let r := mload(add(_signature, 0x20))
            let s := mload(add(_signature, 0x40))
            let v := and(mload(add(_signature, 0x41)), 0xff)

            mstore(add(signature, 0x20), r)
            mstore(add(signature, 0x40), s)
            mstore8(add(signature, 0x60), v)
        }
    }

    function checkValidECDSASignatureFormat(bytes memory _signature)
        internal
        pure
        returns (bool)
    {
        if (_signature.length != 65) {
            return false;
        }

        uint8 v;
        bytes32 r;
        bytes32 s;

        assembly {
            r := mload(add(_signature, 0x20))
            s := mload(add(_signature, 0x40))
            v := and(mload(add(_signature, 0x41)), 0xff)
        }
        if (v != 27 && v != 28) {
            return false;
        }

        if (
            uint256(s) >
            0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0
        ) {
            return false;
        }

        return true;
    }
}
