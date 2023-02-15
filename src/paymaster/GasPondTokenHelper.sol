//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.11;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "zksync-contracts/openzeppelin/token/ERC20/IERC20.sol";
import {ERC20, SafeTransferLib} from "solmate/utils/SafeTransferLib.sol";

contract GasPondTokenHelper {
    using SafeTransferLib for *;
    IUniswapV2Router02 public swapRouter;

    address public weth;

    constructor(address _weth, address _swapRouter) {
        weth = _weth;
        swapRouter = IUniswapV2Router02(_swapRouter);
    }

    function _getTokenFee(address _token, uint256 _eth_fee)
        internal
        view
        returns (uint256)
    {
        address[] memory path = new address[](2);
        path[0] = address(weth);
        path[1] = address(_token);

        // check liquidity pool
        // if no chainlink...?

        uint256[] memory outputs = IUniswapV2Router02(swapRouter).getAmountsIn(
            _eth_fee,
            path
        );
        return outputs[1];
    }

    // transrfer: send token from user to paymster(address(this))
    // require: check if paymaster received sufficient amount of token
    function _payInERC20(
        address _token,
        uint256 _amount,
        address _user
    ) internal {
        uint256 balanceBefore = IERC20(_token).balanceOf(address(this));
        SafeTransferLib.safeTransferFrom(
            ERC20(_token),
            _user,
            address(this),
            _amount
        );

        uint256 balanceAfter = IERC20(_token).balanceOf(address(this));
        require(
            balanceAfter >= _amount + balanceBefore,
            "Insufficient Token received"
        );
    }

    function _swapERC20ForETH(address _token, uint256 _amount) internal {
        address[] memory path = new address[](2);
        path[0] = address(_token);
        path[1] = address(weth);

        uint256[] memory outputs = IUniswapV2Router02(swapRouter).getAmountsOut(
            _amount,
            path
        );

        IUniswapV2Router02(swapRouter).swapExactTokensForETH(
            _amount,
            outputs[1],
            path,
            address(this),
            type(uint256).max
        );
    }

    function _withdrawETH(uint256 _amount) internal {
        require(_amount != 0, "INVALID_AMOUNT");
        SafeTransferLib.safeTransferETH(msg.sender, _amount);
    }

    function _withdrawToken(address _token, uint256 _amount) internal {
        require(_amount != 0, "INVALID_AMOUNT");
        SafeTransferLib.safeTransfer(ERC20(_token), msg.sender, _amount);
    }
}
