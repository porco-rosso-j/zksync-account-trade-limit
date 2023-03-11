// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.4;

import "../UniswapV2ERC20.sol";

contract ERC20Mock is UniswapV2ERC20 {
    constructor(uint256 _totalSupply) {
        _mint(msg.sender, _totalSupply);
    }
}
