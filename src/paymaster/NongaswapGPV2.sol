//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {IPaymaster, ExecutionResult, PAYMASTER_VALIDATION_SUCCESS_MAGIC} from "zksync-contracts/interfaces/IPaymaster.sol";
import {TransactionHelper, Transaction} from "zksync-contracts/libraries/TransactionHelper.sol";
import {BOOTLOADER_FORMAL_ADDRESS} from "zksync-contracts/Constants.sol";

import {SwapArgDecoder} from "./lib/SwapArgDecoder.sol";
import {NongaswapGPV2Storage} from "./NongaswapGPV2Storage.sol";
import {GasPondHelper} from "./helpers/GasPondHelper.sol";
import {GasPondTokenHelper} from "./helpers/GasPondTokenHelper.sol";

contract NongaswapGPV2 is
    IPaymaster,
    NongaswapGPV2Storage,
    GasPondHelper,
    GasPondTokenHelper
{
    using TransactionHelper for Transaction;
    using SwapArgDecoder for bytes;

    modifier onlyBootloader() {
        require(msg.sender == BOOTLOADER_FORMAL_ADDRESS, "NOT_BOOTLOADER");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor(address _weth, address _swapRouter)
        GasPondTokenHelper(_weth, _swapRouter)
    {
        owner = msg.sender;
    }

    // ================================================================= //
    //                          Admin Operations                         //
    // ================================================================= //

    function _isValidSponsor(address _sponsor) internal view returns (bool) {
        if (sponsors[_sponsor].isValidSponsor) {
            return true;
        } else {
            return false;
        }
    }

    function addRouter(address _router) public onlyOwner {
        require(_router != address(0), "INVALID_ADDRESS");
        isValidRouter[_router] = true;
    }

    function removeRouter(address _router) public onlyOwner {
        require(_router != address(0), "INVALID_ADDRESS");
        require(isValidRouter[_router], "NOT_ADDED");
        isValidRouter[_router] = false;
    }

    // ================================================================= //
    //                        Paymaster Validation                       //
    // ================================================================= //

    function validateAndPayForPaymasterTransaction(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    )
        external
        payable
        override
        onlyBootloader
        returns (bytes4 magic, bytes memory)
    {
        magic = PAYMASTER_VALIDATION_SUCCESS_MAGIC;

        require(
            address(uint160(_transaction.paymaster)) == address(this),
            "INVALID_PAYMASTER"
        );

        require(_transaction.paymasterInput.length >= 4, "INVALID_BYTE_LENGTH");

        require(
            isValidRouter[address(uint160(_transaction.to))],
            "INVALID_ROUTER"
        );

        uint256 eth_fee = _transaction.gasLimit * _transaction.maxFeePerGas;
        address sponsorAddr;

        if (_isApprovalBased(bytes4(_transaction.paymasterInput[0:4]))) {
            (
                address token,
                uint256 allowance,
                address _sponsorAddr
            ) = _getApprovalBasedParams(_transaction.paymasterInput[4:]);

            sponsorAddr = _sponsorAddr;

            _isValidSponsor(sponsorAddr);

            _approvalBasedFlow(
                token,
                allowance,
                sponsorAddr,
                _transaction,
                eth_fee
            );
        } else {
            (address _sponsorAddr, address ownedAsset) = _getGeneralParams(
                _transaction.paymasterInput[4:]
            );
            sponsorAddr = _sponsorAddr;

            _isValidSponsor(sponsorAddr);

            _validateOwnership(
                address(uint160(_transaction.from)),
                sponsorAddr,
                ownedAsset
            );
        }

        require(
            sponsors[sponsorAddr].ethBalance >= eth_fee,
            "INSUFFICIENT_SPONSOR_BALANCE"
        );

        _validateSwapAsset(sponsorAddr, _transaction.data, _transaction.value);

        _validateLimit(
            sponsorAddr,
            eth_fee,
            _transaction.gasLimit,
            _transaction.maxFeePerGas
        );

        _payErgs(sponsorAddr, eth_fee);
    }

    function _payErgs(address _sponsorAddr, uint256 _eth_fee) internal {
        (bool success, ) = payable(BOOTLOADER_FORMAL_ADDRESS).call{
            value: _eth_fee
        }("");
        require(success, "GAS_PAYMENT_FAILED");

        sponsors[_sponsorAddr].ethBalance -= _eth_fee;
    }

    function _approvalBasedFlow(
        address _token,
        uint256 _allowance,
        address _sponsorAddr,
        Transaction calldata _transaction,
        uint256 _eth_fee
    ) internal {
        ERC20Payment memory erc20payment = sponsors[_sponsorAddr].erc20payments[
            _token
        ];

        require(erc20payment.isEnabled, "INVALID_TOKEN");
        require(erc20payment.minFee <= _allowance, "INVALID_ALLOWANCE");

        uint256 token_fee = _getTokenFee(_token, _eth_fee);

        require(erc20payment.maxFee >= token_fee, "EXCEED_MAXFEE");

        if (erc20payment.discountRate != 0) {
            token_fee =
                (token_fee * erc20payment.discountRate) /
                DECIMAL_PRECISION;
        }

        _payInERC20(_token, token_fee, address(uint160(_transaction.from)));

        sponsors[_sponsorAddr].erc20Balances[_token] = token_fee;
    }

    function _validateSwapAsset(
        address _sponsorAddr,
        bytes calldata _data,
        uint256 _value
    ) internal view {
        address[] memory path;
        if (_value != 0) {
            (, path, , ) = SwapArgDecoder._decodeSwapETHArgs(_data);
        } else {
            (, , path, , ) = _data.decodeSwapArgs();
        }
        bool isSupported = isSponsoredPath(path, _sponsorAddr);
        require(isSupported, "NOT_SUPPORTED_ASSET");
    }

    // if enabled, holders of certain assets like a governance token or a NFT
    // can be entitiled for being sponsored.
    // e.g. 1000 xSUSHI holder can transact for free on Sushiswap.
    function _validateOwnership(
        address _from,
        address _sponsorAddr,
        address _ownedAsset
    ) internal view {
        if (_ownedAsset != address(0)) {
            Sponsor storage sponsor = sponsors[_sponsorAddr];

            if (sponsor.ownerships[_ownedAsset].isEnabled) {
                OwnershipSponsor memory ownership = sponsor.ownerships[
                    _ownedAsset
                ];

                if (ownership.isERC20) {
                    require(
                        _getERC20Balance(_ownedAsset, _from) >=
                            ownership.minOwnership,
                        "OWNERSHIP_NOT_CONFIRMED"
                    );
                } else {
                    require(
                        _getERC721Balance(_ownedAsset, _from) >=
                            ownership.minOwnership,
                        "OWNERSHIP_NOT_CONFIRMED"
                    );
                }
            }
        }
    }

    function _validateLimit(
        address _sponsorAddr,
        uint256 _eth_fee,
        uint256 _maxGas,
        uint256 _maxFeePerGas
    ) internal {
        Limit storage limit = sponsors[_sponsorAddr].limit;

        if (!limit.isEnabled) return;

        require(
            limit.maxGas <= _maxGas && limit.maxFeePerGas <= _maxFeePerGas,
            "INVALID_GAS"
        );

        uint256 timestamp = block.timestamp;

        if (limit.limit != limit.available && timestamp > limit.resetTime) {
            limit.resetTime = timestamp + limit.duration;
            limit.available = limit.limit;
        } else if (limit.limit == limit.available) {
            limit.resetTime = timestamp + limit.duration;
        }

        // reverts if the amount exceeds the remaining available amount.
        require(limit.available >= _eth_fee, "EXCEED_LIMIT");

        // decrement `available`
        limit.available -= _eth_fee;
    }

    function postTransaction(
        bytes calldata _context,
        Transaction calldata _transaction,
        bytes32,
        bytes32,
        ExecutionResult _txResult,
        uint256 _maxRefundedGas
    ) external payable override {
        // Refunds are not supported yet.
    }

    // ================================================================= //
    //                      Sponsor Configurations                       //
    // ================================================================= //

    // --- Paymaster's Registration --- //

    function registerSponsor() public payable {
        require(msg.value >= minimumETHBalalance, "INVALIT_AMOUNT");
        require(!sponsors[msg.sender].isValidSponsor, "ALREADY_VALID");

        sponsors[msg.sender].isValidSponsor = true;
        sponsors[msg.sender].ethBalance = msg.value;
    }

    // --- Paymaster's Limit Configurations --- //
    function setLimit(
        uint256 _limit,
        uint256 _duration,
        uint256 _maxFeePerGas,
        uint256 _maxGas
    ) public {
        require(_isValidSponsor(msg.sender), "INVALID_SPONSOR");

        require(_limit != 0, "INVALID_AMOUNT");
        require(_duration != 0, "INVALID_AMOUNT");
        require(_maxFeePerGas != 0, "INVALID_AMOUNT");
        require(_maxGas != 0, "INVALID_AMOUNT");

        Limit storage limit = sponsors[msg.sender].limit;

        limit.limit = _limit;
        limit.available = _limit;
        limit.duration = _duration;
        limit.duration = 0;
        limit.maxFeePerGas = _maxFeePerGas;
        limit.maxGas = _maxGas;
        limit.isEnabled = true;
    }

    function removeLimit() public {
        require(_isValidSponsor(msg.sender), "INVALID_SPONSOR");

        Limit storage limit = sponsors[msg.sender].limit;
        require(limit.isEnabled, "LIMIT_NOT_ENABLED");

        limit.limit = 0;
        limit.available = 0;
        limit.duration = 0;
        limit.duration = 0;
        limit.maxFeePerGas = 0;
        limit.maxGas = 0;
        limit.isEnabled = false;
    }

    // --- Paymaster's Ownership Sponsor Configurations --- //

    function setOwnershipSponsor(
        address _asset,
        uint256 _minOwnership,
        bool _isERC20
    ) public {
        require(_isValidSponsor(msg.sender), "INVALID_SPONSOR");
        require(_asset != address(0), "INVALID_ASSET");
        require(_minOwnership != 0, "INVALID_AMOUNT");

        OwnershipSponsor storage ownership = sponsors[msg.sender].ownerships[
            _asset
        ];

        ownership.minOwnership = _minOwnership;
        ownership.isERC20 = _isERC20;
        ownership.isEnabled = true;
    }

    function removeOwnershipSponsor(address _asset) public {
        require(_isValidSponsor(msg.sender), "INVALID_SPONSOR");
        require(_asset != address(0), "INVALID_ASSET");

        OwnershipSponsor storage ownership = sponsors[msg.sender].ownerships[
            _asset
        ];

        require(ownership.isEnabled, "NOT_ENABLED");

        ownership.minOwnership = 0;
        ownership.isERC20 = false;
        ownership.isEnabled = false;
    }

    // --- Paymaster's ERC20 Configurations --- //

    function setERC20PaymentInfo(
        address _token,
        uint256 _maxFee,
        uint256 _minFee,
        uint256 _discountRate
    ) public {
        require(_isValidSponsor(msg.sender), "INVALID_SPONSOR");
        require(_token != address(0), "INVALID_TOKEN");
        require(_maxFee != 0, "INVALID_AMOUNT");
        require(_minFee != 0, "INVALID_AMOUNT");
        require(_discountRate != 0 && _discountRate <= 1e18, "INVALID_AMOUNT");

        ERC20Payment storage erc20payment = sponsors[msg.sender].erc20payments[
            _token
        ];

        erc20payment.maxFee = _maxFee;
        erc20payment.minFee = _minFee;
        erc20payment.discountRate = _discountRate;
        erc20payment.isEnabled = true;
    }

    function removeERC20PaymentInfo(address _token) public {
        require(_isValidSponsor(msg.sender), "INVALID_SPONSOR");
        require(_token != address(0), "INVALID_TOKEN");

        ERC20Payment storage erc20payment = sponsors[msg.sender].erc20payments[
            _token
        ];

        require(!erc20payment.isEnabled, "NOT_ENABLED");

        erc20payment.maxFee = 0;
        erc20payment.minFee = 0;
        erc20payment.discountRate = 0;
        erc20payment.isEnabled = false;
    }

    // --- Paymaster's SwapAsset Sponsor Configurations --- //

    function setSponsoredSwapAsset(address[] memory _tokens) public {
        require(_isValidSponsor(msg.sender), "INVALID_SPONSOR");

        Sponsor storage sponsor = sponsors[msg.sender];

        address token;
        for (uint256 i = 0; i < _tokens.length; i++) {
            token = _tokens[i];

            require(token != address(0), "INVALID_ADDRESS");

            if (!sponsor.isSupportedSwapAsset[token]) {
                sponsor.isSupportedSwapAsset[token] = true;
            }
        }
    }

    function removeSponsoredSwapAsset(address _token) public {
        require(_isValidSponsor(msg.sender), "INVALID_SPONSOR");

        Sponsor storage sponsor = sponsors[msg.sender];

        require(sponsor.isSupportedSwapAsset[_token], "NOT_SUPPORTED");
        sponsor.isSupportedSwapAsset[_token] = false;
    }

    // --- Paymaster's Token Operations --- //

    function depositETH() public payable returns (uint256) {
        require(_isValidSponsor(msg.sender), "INVALID_SPONSOR");
        sponsors[msg.sender].ethBalance += msg.value;
        return sponsors[msg.sender].ethBalance;
    }

    function withdrawETH(uint256 _amount) public {
        require(_isValidSponsor(msg.sender), "INVALID_SPONSOR");
        require(_amount != 0, "INVALID_AMOUNT");
        require(
            sponsors[msg.sender].ethBalance >= _amount,
            "INSUFFICIENT_AMOUNT"
        );
        _withdrawETH(_amount);
    }

    function withdrawToken(address _token, uint256 _amount) public {
        require(_isValidSponsor(msg.sender), "INVALID_SPONSOR");
        require(
            sponsors[msg.sender].erc20payments[_token].isEnabled,
            "INVALID_TOKEN"
        );
        require(_amount != 0, "INVALID_AMOUNT");
        require(_getERC20Balance(_token, address(this)) != 0, "NO_BALANCE");
        _withdrawToken(_token, _amount);
    }

    function swapTokensForETH(
        address[] memory _tokens,
        uint256[] memory _amounts
    ) public {
        require(
            _tokens.length == _amounts.length && _tokens.length != 0,
            "INVALID_LENDGTH"
        );
        for (uint256 i = 0; i < _tokens.length; i++) {
            swapTokenForETH(_tokens[i], _amounts[i]);
        }
    }

    function swapTokenForETH(address _token, uint256 _amount) public {
        require(_isValidSponsor(msg.sender), "INVALID_SPONSOR");
        require(_token != address(0), "INVALID_ADDRESS");
        require(_amount != 0, "INVALID_AMOUNT");

        sponsors[msg.sender].erc20Balances[_token] -= _amount;

        uint256 BalanceBeforeSwap = address(this).balance;

        _swapERC20ForETH(_token, _amount);

        uint256 BalanceAfterSwap = address(this).balance;
        sponsors[msg.sender].ethBalance += (BalanceAfterSwap -
            BalanceBeforeSwap);
    }

    // ================================================================= //
    //                      Sponsor View Funcitons                       //
    // ================================================================= //

    function getSponsorETHBalance(address _sponsor)
        public
        view
        returns (uint256)
    {
        return sponsors[_sponsor].ethBalance;
    }

    function getSponsorERC20Balance(address _sponsor, address _token)
        public
        view
        returns (uint256)
    {
        return sponsors[_sponsor].erc20Balances[_token];
    }

    function getOwnershipSponsor(address _sponsor, address _token)
        public
        view
        returns (
            uint256,
            bool,
            bool
        )
    {
        OwnershipSponsor storage ownership = sponsors[_sponsor].ownerships[
            _token
        ];
        return (ownership.minOwnership, ownership.isERC20, ownership.isEnabled);
    }

    function getERC20Payment(address _sponsor, address _token)
        public
        view
        returns (
            uint256,
            uint256,
            uint256,
            bool
        )
    {
        ERC20Payment storage erc20payment = sponsors[_sponsor].erc20payments[
            _token
        ];
        return (
            erc20payment.maxFee,
            erc20payment.minFee,
            erc20payment.discountRate,
            erc20payment.isEnabled
        );
    }

    function getLimit(address _sponsor)
        public
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            bool
        )
    {
        Limit storage limit = sponsors[_sponsor].limit;
        return (
            limit.limit,
            limit.available,
            limit.duration,
            limit.duration,
            limit.maxFeePerGas,
            limit.maxGas,
            limit.isEnabled
        );
    }

    function isSponsoredPath(address[] memory path, address _sponsorAddr)
        public
        view
        returns (bool)
    {
        bool result;
        for (uint256 i = 0; i < path.length; i++) {
            result = isSponsoredAsset(path[i], _sponsorAddr);
            if (result) return true;
        }

        return false;
    }

    function isSponsoredAsset(address _token, address _sponsorAddr)
        public
        view
        returns (bool)
    {
        Sponsor storage sponsor = sponsors[_sponsorAddr];
        if (
            sponsor.ethBalance >= minimumETHBalalance &&
            sponsor.isSupportedSwapAsset[_token]
        ) {
            return true;
        }
        return false;
    }

    receive() external payable {
        depositETH();
    }
}
