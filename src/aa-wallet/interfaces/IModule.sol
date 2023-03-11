//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IModule {
    function moduleIdentifier() external view returns (bytes4);

    function isAccountEnabled(address _account) external view returns (bool);

    function addAccount(address _account) external;

    function removeAccount(address _account) external;

    function setModuleId(uint256 _moduleId) external;

    function moduleId() external view returns (uint256); //
}
