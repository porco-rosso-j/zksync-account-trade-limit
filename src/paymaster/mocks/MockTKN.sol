// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {MockERC20} from "solmate/test/utils/mocks/MockERC20.sol";

contract MockTKN is MockERC20 {
    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) MockERC20(_name, _symbol, _decimals) {}

    function mint(address to, uint256 value) public override {
        _mint(to, value);
    }

    function burn(address from, uint256 value) public override {
        _burn(from, value);
    }
}
