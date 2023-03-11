//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {IModule} from "../interfaces/IModule.sol";
import {IModuleManager} from "../interfaces/IModuleManager.sol";

/**
@title ModuleManager Contract that manages multiple modules. 
@author Porco Rosso<porcorossoj89@gmail.com>
@notice core contract for modules, which stores the data of each module.
@dev modules and other contracts such as GasPond and Accounts calls ModuleManager to obtain module and account information.

*/

contract ModuleManager is IModuleManager {
    address public admin;

    // accountRegistry in this contract is often called using IModuleManager for other contracts
    // which don't inherit accountRegistry but this contract
    address public accountRegistry;

    struct Module {
        uint256 id;
        address module;
        address modulebase;
    }

    mapping(uint256 => Module) public modules; // moduleId => Module
    uint256 moduleIndex;

    constructor(address _admin, address _accountRegistry) {
        admin = _admin;
        accountRegistry = _accountRegistry;
    }

    function addModule(address _module, address _moduleBase)
        external
        returns (uint256)
    {
        require(admin == msg.sender, "INAVLID_CALLER");
        uint256 nexModuleIndex = moduleIndex + 1;
        modules[nexModuleIndex].id = nexModuleIndex;
        modules[nexModuleIndex].module = _module;
        modules[nexModuleIndex].modulebase = _moduleBase;

        // allocate moduleId to each added module
        IModule(_moduleBase).setModuleId(nexModuleIndex);

        moduleIndex++;

        return nexModuleIndex;
    }

    /// @param _moduleId the identifier number that is used to get the information about every module.
    /// @return module address
    /// @return modulebase address
    function getModule(uint256 _moduleId)
        external
        view
        returns (address, address)
    {
        return (modules[_moduleId].module, modules[_moduleId].modulebase);
    }
}
