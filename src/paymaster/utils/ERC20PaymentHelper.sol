pragma solidity 0.8.11;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "zksync-contracts/openzeppelin/token/ERC20/IERC20.sol";
import {ERC20, SafeTransferLib} from "solmate/utils/SafeTransferLib.sol";

contract ERC20PaymentHelper {
    using SafeTransferLib for *;
    IUniswapV2Router02 public swapRouter;

    address public weth;

    constructor(address _weth, address _swapRouter) {
        weth = _weth;
        swapRouter = IUniswapV2Router02(_swapRouter);
    }

    // token_fee: token amount for gas == eth amount for gas / {eth/token} rate
    function _calcuFees(
        uint256 _ergsLimit,
        uint256 _maxFeePerErg,
        address _token
    ) internal view returns (uint256, uint256) {
        uint256 eth_fee = _ergsLimit * _maxFeePerErg;
        uint256 token_fee = _getTokenFee(_token, eth_fee);
        return (token_fee, eth_fee);
    }

    function _getTokenFee(address _token, uint256 _amount)
        public
        view
        returns (uint256)
    {
        address[] memory path = new address[](2);
        path[0] = address(weth);
        path[1] = address(_token);

        uint256[] memory outputs = IUniswapV2Router01(swapRouter).getAmountsOut(
            _amount,
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
}
