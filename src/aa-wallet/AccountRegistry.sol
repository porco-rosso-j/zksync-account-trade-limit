//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "zksync-contracts/interfaces/IAccount.sol";
import "./interfaces/IAccountRegistry.sol";

/**
@title Account Registry Contract that stoers all Account contracts deployed by AccountFactory contract
@author Porco Rosso<porcorossoj89@gmail.com>
*/

contract AccountRegistry is IAccountRegistry {
    mapping(address => bool) public accounts;

    /**
    @notice this function stores account address into accounts mapping and marks it as true
    @param accountAddr account address deployed by AccountFactory
    */
    function _storeAccount(address accountAddr) external {
        accounts[accountAddr] = true;
    }

    /**
    @notice this function returns true if an account is legit, meaning it was successfully deployed by AccountFactory
    @param _account account address
    */
    function isAccount(address _account) external view returns (bool) {
        // check if account surpports the IAccount Interface
        return
            accounts[_account] &&
            IERC165(_account).supportsInterface(type(IAccount).interfaceId);
    }
}
