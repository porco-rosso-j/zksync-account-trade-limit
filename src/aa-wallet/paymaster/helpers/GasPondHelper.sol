//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
import {IPaymasterFlow} from "zksync-contracts/interfaces/IPaymasterFlow.sol";

/**
@title GasPondHelper Contract that serves as a helper for Gaspond contract
@author Porco Rosso<porcorossoj89@gmail.com>
@notice This contract mainly does two things below: 
1) checks and returns that whether the transaction's paymasterFlow is approvalBased is general in _isApprovalBased
2) decodes paymasterParams and its input, and returns the values to GasPond for verification in either _getApprovalBasedParams or _getGeneralParams
*/

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

        address sponsorAddr = _getSponsorAddr(input);
        return (token, allowance, sponsorAddr);
    }

    function _getGeneralParams(bytes memory _data)
        internal
        pure
        returns (address)
    {
        bytes memory input = abi.decode(_data, (bytes));
        return _getSponsorAddr(input);
    }

    function _getSponsorAddr(bytes memory _input)
        internal
        pure
        returns (address)
    {
        address sponsorAddr = abi.decode(_input, (address));
        require(sponsorAddr != address(0), "INAVLID_ADDRESS");
        return sponsorAddr;
    }
}
