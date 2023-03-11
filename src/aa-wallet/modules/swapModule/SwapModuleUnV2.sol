//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../../../swap/UniswapV2Router.sol";
import "../../../swap/test/WETH9.sol";
import "./SwapModuleBase.sol";

/**
@title SwapModuleUniV2 Contract that executes swap transactions.
@author Porco Rosso<porcorossoj89@gmail.com>
@dev this contract is always delegatecalled from Account contract and calls an AMM's router contract.
@dev While this contract does all executions, its pairing contract SwapModuleBase is in charge of all the validations logic and storing variables.
@dev It only has three methods for swapping available in UniswapV2 to be as simple as posssible, though surely they can be added.
*/

contract SwapModuleUniV2 {
    /// @dev only immutable state variables are readable internally when getting delegatecalled
    IUniswapV2Router public immutable swapRouter;
    ISwapModuleBase public immutable base;

    constructor(address _swapRouter, address _base) {
        swapRouter = IUniswapV2Router(_swapRouter);
        base = ISwapModuleBase(_base);
    }

    /**
    @notice function to execute swapExactETHForTokens() on UniswapV2Router 
    @param _tokenInAmount the ETH amount that the caller account sells for another token
    @param _path the address array of the tokens swapped via the router 
     */
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

        // fetch estimated output amount by getAmountsOut()
        uint256[] memory expectdAmountOut = swapRouter.getAmountsOut(
            _tokenInAmount,
            _path
        );

        // output token amount is always located at the end of the path[]
        uint256 amountOutIndex = expectdAmountOut.length - 1;

        swapRouter.swapExactETHForTokens{value: _tokenInAmount}(
            expectdAmountOut[amountOutIndex],
            _path,
            address(this),
            type(uint256).max
        );
    }

    /**
    @notice function to execute swapExactTokensForETH() on UniswapV2Router 
    @param _tokenInAmount the token amount that the caller account sells for ETH
    @param _path the address array of the tokens swapped via the router 
     */
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

        // fetch estimated output amount by getAmountsOut()
        uint256[] memory expectdAmountOut = swapRouter.getAmountsOut(
            _tokenInAmount,
            _path
        );

        // output token amount is always located at the end of the path[]
        uint256 amountOutIndex = expectdAmountOut.length - 1;

        swapRouter.swapExactTokensForETH(
            _tokenInAmount,
            expectdAmountOut[amountOutIndex],
            _path,
            address(this),
            block.timestamp + 1
        );
    }

    /**
    @notice function to execute swapExactTokensForETH() on UniswapV2Router 
    @param _tokenInAmount the token amount that the caller account sells for ETH
    @param _path the address array of the tokens swapped via the router 
     */
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

    /**
    @dev 
    The three methods following used to be unused in the three swap functions above. 
    But they were removed intentionally for the sake of the demonstration of muilticall feacture that Account has, 
    which allows it to interact with WETH and ERC20 token contracts.

    Hence, these haven't been deleted from this contract as it will likely be used in the future. 
    */

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
