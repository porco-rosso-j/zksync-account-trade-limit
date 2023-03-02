//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {IUniswapV2Router} from "@uniswap/interfaces/IUniswapV2Router.sol";
import {IERC20} from "zksync-contracts/openzeppelin/token/ERC20/IERC20.sol";

contract GasPondTokenHelper {
    IUniswapV2Router public swapRouter;
    address public weth;

    constructor(address _weth, address _swapRouter) {
        weth = _weth;
        swapRouter = IUniswapV2Router(_swapRouter);
    }

    // can be replacable with RedStone oracles.
    function _getTokenFee(address _token, uint256 _eth_fee)
        internal
        view
        returns (uint256)
    {
        address[] memory path = new address[](2);
        path[0] = weth;
        path[1] = _token;

        // check liquidity pool
        // if no chainlink...?

        uint256[] memory outputs = swapRouter.getAmountsIn(_eth_fee, path);
        return outputs[0];
    }

    // transrfer: send token from user to paymster(address(this))
    // require: check if paymaster received sufficient amount of token
    function _payInERC20(
        address _token,
        address _user,
        uint256 _amount
    ) internal {
        uint256 balanceBefore = _getERC20Balance(_token, address(this));
        IERC20(_token).transferFrom(_user, address(this), _amount);

        uint256 balanceAfter = _getERC20Balance(_token, address(this));
        require(balanceAfter >= _amount + balanceBefore, "INSUFFICIENT_AMOUNT");
    }

    function _withdrawETH(uint256 _amount) internal {
        require(_amount != 0, "INVALID_AMOUNT");
        (bool suceess, ) = msg.sender.call{value: _amount}("");
        if (!suceess) revert("WITHDRAWAL_FAILED");
    }

    function _withdrawToken(address _token, uint256 _amount) internal {
        require(_amount != 0, "INVALID_AMOUNT");
        IERC20(_token).transfer(msg.sender, _amount);
    }

    function _getERC20Balance(address _token, address _from)
        internal
        view
        returns (uint256)
    {
        return IERC20(_token).balanceOf(_from);
    }
}
