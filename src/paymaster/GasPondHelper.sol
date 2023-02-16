//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.11;
import {IPaymasterFlow} from "zksync-contracts/interfaces/IPaymasterFlow.sol";

abstract contract GasPondHelper {
    function _isApprovalBased(bytes4 _paymasterInputSelector)
        internal
        pure
        returns (bool)
    {
        if (_paymasterInputSelector == IPaymasterFlow.approvalBased.selector) {
            return true;
        } else if (_paymasterInputSelector == IPaymasterFlow.general.selector) {
            return false;
        } else {
            revert("UNSUPPORTED_FLOW");
        }
    }

    function _getApprovalBasedParams(bytes memory _data)
        internal
        pure
        returns (
            address,
            uint256,
            address
        )
    {
        (address token, uint256 allowance, bytes memory input) = abi.decode(
            _data,
            (address, uint256, bytes)
        );

        require(token != address(0), "INAVLID_ADDRESS");
        require(allowance != 0, "INVALID_AMOUNT");

        (address sponsorAddr, ) = abi.decode(input, (address, address));
        require(sponsorAddr != address(0), "INAVLID_INDEX");

        return (token, allowance, sponsorAddr);
    }

    function _getGeneralParams(bytes memory _data)
        internal
        pure
        returns (address, address)
    {
        bytes memory input = abi.decode(_data, (bytes));

        (address sponsorAddr, address ownedAsset) = abi.decode(
            input,
            (address, address)
        );

        require(sponsorAddr != address(0), "INAVLID_INDEX");
        require(ownedAsset != address(0), "INAVLID_INDEX");

        return (sponsorAddr, ownedAsset);
    }
}
