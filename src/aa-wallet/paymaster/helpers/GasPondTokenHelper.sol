//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {IUniswapV2Router} from "@uniswap/interfaces/IUniswapV2Router.sol";
import {IERC20} from "zksync-contracts/openzeppelin/token/ERC20/IERC20.sol";

/**
@title GasPondTokenHelper Contract that helps Gaspond contract interacts with ERC20 tokens 
@author Porco Rosso<porcorossoj89@gmail.com>
@notice 
*/

contract GasPondTokenHelper {
    IUniswapV2Router public swapRouter;
    address public weth;

    constructor(address _weth, address _swapRouter) {
        weth = _weth;
        swapRouter = IUniswapV2Router(_swapRouter);
    }

    /**
    @notice this function obtains an exchange rate between eth and a gas-payment token from AMM router
    @param _token the ERC20 token address used for gas payment
    @param _eth_fee the gas fee in ETH (maxFeePerGas * gasLimit)
     */
    function _getTokenFee(address _token, uint256 _eth_fee)
        internal
        view
        returns (uint256)
    {
        address[] memory path = new address[](2);
        path[0] = weth;
        path[1] = _token;

        // obtain exchange rate between eth and a gas-payment token from AMM router.
        // gets an equivalent value of ERC20 token amounts to _eth_fee
        uint256[] memory outputs = swapRouter.getAmountsIn(_eth_fee, path);
        return outputs[0];
    }

    /**
    @notice this function transfer ERC20 token from user to paymster(address(this))
    @param _token the ERC20 token address used for gas payment
    @param _user the address of user who pays gas fee
    @param _amount the amount of gas payment
     */
    function _payInERC20(
        address _token,
        address _user,
        uint256 _amount
    ) internal {
        uint256 balanceBefore = _getERC20Balance(_token, address(this));

        // SafeTransferLib.safeTrasnferFrom doesn't work on zkSync
        IERC20(_token).transferFrom(_user, address(this), _amount);

        uint256 balanceAfter = _getERC20Balance(_token, address(this));
        // make sure that sufficient amount is transferred from user to this address
        require(balanceAfter >= _amount + balanceBefore, "INSUFFICIENT_AMOUNT");
    }

    /**
    @notice this function allows sponsors to withdraw thier deposited ETH
    @param _amount the amount of eth withdrawn
    */
    function _withdrawETH(uint256 _amount) internal {
        require(_amount != 0, "INVALID_AMOUNT");
        (bool suceess, ) = msg.sender.call{value: _amount}("");
        if (!suceess) revert("WITHDRAWAL_FAILED");
    }

    /**
    @notice this function allows sponsors to withdraw ERC20 they can claim
    @param _amount the amount of eth withdrawn
    */
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
