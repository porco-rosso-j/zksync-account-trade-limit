//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IAccountRegistry {
    function _storeAccount(address accountAddr) external;

    function isAccount(address accountAddr) external view returns (bool);
}
