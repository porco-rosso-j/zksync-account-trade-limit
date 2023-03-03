pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "zksync-contracts/interfaces/IAccount.sol";
import "./interfaces/IAccountRegistry.sol";

contract AccountRegistry is IAccountRegistry {
    mapping(address => bool) public accounts;

    function _storeAccount(address accountAddr) external {
        accounts[accountAddr] = true;
    }

    function isAccount(address _account) external view returns (bool) {
        // check if account surpports the IAccount Interface
        return
            accounts[_account] &&
            IERC165(_account).supportsInterface(type(IAccount).interfaceId);
    }
}
