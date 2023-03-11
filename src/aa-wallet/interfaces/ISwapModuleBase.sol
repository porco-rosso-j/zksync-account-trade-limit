//SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import "./IModule.sol";

interface ISwapModuleBase is IModule {
    function _isValidTrade(
        address _account,
        address _router,
        uint256 _amount,
        address[] memory _path
    ) external returns (bool);

    function wethAddr() external view returns (address);
}
