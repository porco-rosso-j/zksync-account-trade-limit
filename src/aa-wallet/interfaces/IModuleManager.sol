pragma solidity ^0.8.0;

interface IModuleManager {
    function getModule(uint256 _id) external view returns (address, address);
}
