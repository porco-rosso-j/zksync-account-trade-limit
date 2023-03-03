// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../../../swap/UniswapV2Router.sol";
import "../../../swap/test/WETH9.sol";
import "./SwapModuleBase.sol";

/*

SwapModuleUniV2: Execute transactions delegatecalled from Account contracts
- auto-approve erc20 token when account doesn't have enough allowance.
- only support swapExact*** methods for the sake of simplicity.

 Flo
- delegatecall: account -> swapmodule
- call: swapmodule -> uniswap

*/

contract SwapModuleUniV2 {
    IUniswapV2Router public immutable swapRouter;
    ISwapModuleBase public immutable base;

    constructor(address _swapRouter, address _base) {
        swapRouter = IUniswapV2Router(_swapRouter);
        base = ISwapModuleBase(_base);
    }

    function swapETHForToken(uint256 _tokenInAmount, address[] calldata _path)
        external
        payable
    {
        require(base.isAccountEnabled(address(this)), "INVALID_ACCOUNT");
        require(
            base._isValidTrade(
                address(this),
                address(swapRouter),
                _tokenInAmount,
                _path
            ),
            "INVALID_TRADE"
        );

        uint256[] memory expectdAmountOut = swapRouter.getAmountsOut(
            _tokenInAmount,
            _path
        );
        uint256 amountOutIndex = expectdAmountOut.length - 1;

        swapRouter.swapExactETHForTokens{value: _tokenInAmount}(
            expectdAmountOut[amountOutIndex],
            _path,
            address(this),
            type(uint256).max
        );
    }

    function swapTokenForETH(uint256 _tokenInAmount, address[] calldata _path)
        external
    {
        require(base.isAccountEnabled(address(this)), "INVALID_ACCOUNT");
        require(
            base._isValidTrade(
                address(this),
                address(swapRouter),
                _tokenInAmount,
                _path
            ),
            "INVALID_TRADE"
        );

        uint256[] memory expectdAmountOut = swapRouter.getAmountsOut(
            _tokenInAmount,
            _path
        );
        uint256 amountOutIndex = expectdAmountOut.length - 1;

        swapRouter.swapExactTokensForETH(
            _tokenInAmount,
            expectdAmountOut[amountOutIndex],
            _path,
            address(this),
            block.timestamp + 1
        );
    }

    function swapTokenForToken(uint256 _tokenInAmount, address[] calldata _path)
        external
    {
        require(base.isAccountEnabled(address(this)), "INVALID_ACCOUNT");
        require(
            base._isValidTrade(
                address(this),
                address(swapRouter),
                _tokenInAmount,
                _path
            ),
            "INVALID_TRADE"
        );

        uint256[] memory expectdAmountOut = swapRouter.getAmountsOut(
            _tokenInAmount,
            _path
        );
        uint256 amountOutIndex = expectdAmountOut.length - 1;

        swapRouter.swapExactTokensForTokens(
            _tokenInAmount,
            expectdAmountOut[amountOutIndex],
            _path,
            address(this),
            block.timestamp + 1
        );
    }

    // depositWETH && withdrawWETH called when users convert eth<>weth, and vice versa.
    function depositWETH(uint256 _amount) public {
        IWETH(base.wethAddr()).deposit{value: _amount}();
    }

    function withdrawWETH(uint256 _amount) public payable {
        IWETH(base.wethAddr()).withdraw(_amount);
    }

    function approveToken(address _token, uint256 _amount) public {
        require(base.isAccountEnabled(address(this)), "INVALID_ACCOUNT");
        uint256 allowance = IERC20(_token).allowance(
            address(this),
            address(swapRouter)
        );
        if (allowance <= _amount) {
            IERC20(_token).approve(address(swapRouter), _amount);
        }
    }

    fallback() external {}
}
