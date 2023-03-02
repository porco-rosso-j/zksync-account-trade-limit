// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IModule.sol";

interface ISwapModuleBase is IModule {
    function _isValidTrade(uint256 _amount, address[] memory _path)
        external
        view
        returns (bool);

    function wethAddr() external view returns (address);
}
