pragma solidity ^0.8.0;

import {IModule} from "../interfaces/IModule.sol";
import {IModuleManager} from "../interfaces/IModuleManager.sol";

// this is mock oracle
contract ModuleManager is IModuleManager {
    // mock usd prices

    address public admin;

    struct Module {
        uint256 id;
        address module;
        address modulebase;
    }

    mapping(uint256 => Module) public modules;
    uint256 moduleIndex;

    constructor(address _admin) {
        admin = _admin;
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

        IModule(_moduleBase).setModuleId(nexModuleIndex);

        moduleIndex++;

        return nexModuleIndex;
    }

    function getModule(uint256 _id) external view returns (address, address) {
        return (modules[_id].module, modules[_id].modulebase);
    }
}
