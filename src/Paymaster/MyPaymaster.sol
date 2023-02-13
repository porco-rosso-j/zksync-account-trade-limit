pragma solidity 0.8.11;

import {IPaymaster, ExecutionResult} from "zksync-contracts/interfaces/IPaymaster.sol";
import {IPaymasterFlow} from "zksync-contracts/interfaces/IPaymasterFlow.sol";
import {TransactionHelper, Transaction} from "zksync-contracts/libraries/TransactionHelper.sol";
import "zksync-contracts/Constants.sol";
import "zksync-contracts/openzeppelin/token/ERC20/IERC20.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

contract MyPaymaster is IPaymaster {
    IUniswapV2Router02 public swapRouter;

    address public owner;

    struct TokenInfo {
        uint256 minFee;
        bool sponsored;
        address pricefeed;
    }

    mapping(address => TokenInfo) public tokens;

    modifier onlyBootloader() {
        require(
            msg.sender == BOOTLOADER_FORMAL_ADDRESS,
            "Only bootloader can call this method"
        );
        // Continue execution if called from the bootloader.
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner is allowed");
        _;
    }

    constructor(address _swapRouter) {
        owner = msg.sender;
        swapRouter = IUniswapV2Router02(_swapRouter);
    }

    function validateAndPayForPaymasterTransaction(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    )
        external
        payable
        override
        onlyBootloader
        returns (bytes4 magic, bytes memory context)
    {
        require(
            _transaction.paymasterInput.length >= 4,
            "The standard paymaster input must be at least 4 bytes long"
        );

        bytes4 paymasterInputSelector = bytes4(
            _transaction.paymasterInput[0:4]
        );

        if (paymasterInputSelector == IPaymasterFlow.approvalBased.selector) {
            (address token, , ) = abi.decode(
                _transaction.paymasterInput[4:],
                (address, uint256, bytes)
            );
            address user = address(uint160(_transaction.from));
            require(tokens[token].sponsored == true, "Invalid Token");

            (uint256 token_fee, uint256 eth_fee) = calcuFees(
                _transaction.gasLimit,
                _transaction.maxFeePerGas,
                token
            );

            receiveToken(token, token_fee, user);
            payErgs(eth_fee);
        } else if (paymasterInputSelector == IPaymasterFlow.general.selector) {
            uint256 eth_fee = _transaction.gasLimit * _transaction.maxFeePerGas;
            payErgs(eth_fee);
        } else {
            revert("Unsupported paymaster flow");
        }
    }

    // token_fee: token amount for gas == eth amount for gas / {eth/token} rate
    function calcuFees(
        uint256 _ergsLimit,
        uint256 _maxFeePerErg,
        address _token
    ) internal view returns (uint256, uint256) {
        uint256 eth_fee = _ergsLimit * _maxFeePerErg;
        uint256 token_fee = (eth_fee * 1e18) / getETHPerToken(_token);
        return (token_fee, eth_fee);
    }

    // transrfer: send token from user to paymster(address(this))
    // require: check if paymaster received sufficient amount of token
    function receiveToken(
        address _token,
        uint256 _token_amt,
        address _user
    ) internal {
        uint256 balanceBefore = IERC20(_token).balanceOf(address(this));
        IERC20(_token).transferFrom(_user, address(this), _token_amt);
        require(
            IERC20(_token).balanceOf(address(this)) >=
                _token_amt + balanceBefore,
            "Insufficient Token received"
        );
    }

    function payErgs(uint256 _eth_fee) internal {
        (bool success, ) = payable(BOOTLOADER_FORMAL_ADDRESS).call{
            value: _eth_fee
        }("");
        require(success, "gas payment failed");
    }

    // Management Functions
    function addToken(
        address _token,
        uint256 _amount,
        bool _sponsored,
        address _feed
    ) public onlyOwner {
        tokens[_token].minFee = _amount;
        tokens[_token].sponsored = _sponsored;
        tokens[_token].pricefeed = _feed;
    }

    function addMinTokenFee(address _token, uint256 _amount) public onlyOwner {
        tokens[_token].minFee = _amount;
    }

    function addTokenFeed(address _token, address _feed) public onlyOwner {
        require(tokens[_token].sponsored == true, "token not allowed");
        tokens[_token].pricefeed = _feed;
    }

    function getETHPerToken(address _token) public view returns (uint256) {
        require(
            tokens[_token].pricefeed != address(0),
            "the token doesn't have pricefeed"
        );
        // (, int256 price, , , ) = AggregatorV3Interface(tokens[_token].pricefeed)
        //     .latestRoundData();
        uint256 price;
        return uint256(price);
    }

    /*
    function swapTokenForETH(address _token, uint _amount) public onlyOwner {
        IUniswapRouterV2(uni_router).swap...
    }
    */

    function postTransaction(
        bytes calldata _context,
        Transaction calldata _transaction,
        bytes32 _txHash,
        bytes32 _suggestedSignedHash,
        ExecutionResult _txResult,
        uint256 _maxRefundedErgs
    ) external payable override onlyBootloader {
        // this contract doesnt support any refund logic tho
    }

    receive() external payable {}
}
