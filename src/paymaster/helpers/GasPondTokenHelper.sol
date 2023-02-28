//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {IUniswapV2Router} from "@uniswap/interfaces/IUniswapV2Router.sol";
import {IERC20} from "zksync-contracts/openzeppelin/token/ERC20/IERC20.sol";
import {ERC20, SafeTransferLib} from "solmate/utils/SafeTransferLib.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract GasPondTokenHelper {
    using SafeTransferLib for *;
    IUniswapV2Router public swapRouter;

    address public weth;

    constructor(address _weth, address _swapRouter) {
        weth = _weth;
        swapRouter = IUniswapV2Router(_swapRouter);
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

        uint256[] memory outputs = IUniswapV2Router(swapRouter).getAmountsIn(
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

        uint256[] memory outputs = IUniswapV2Router(swapRouter).getAmountsOut(
            _amount,
            path
        );

        IUniswapV2Router(swapRouter).swapExactTokensForETH(
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

    function _getERC20Balance(address _token, address _from)
        internal
        view
        returns (uint256)
    {
        return IERC20(_token).balanceOf(_from);
    }

    function _getERC721Balance(address _token, address _from)
        internal
        view
        returns (uint256)
    {
        return IERC721(_token).balanceOf(_from);
    }
}
