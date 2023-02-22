//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

abstract contract NongaswapGPV2Storage {
    address public owner;
    uint256 public constant DECIMAL_PRECISION = 1e18;
    uint256 public minimumETHBalalance = 1e16; // 0.01 ETH

    struct Sponsor {
        uint256 sponsorId;
        uint256 ethBalance;
        mapping(address => uint256) erc20Balances; // token => balnace
        mapping(address => bool) isSupportedSwapAsset; // token => bool
        mapping(address => OwnershipSponsor) ownerships; // token => OwnershipSponsor
        mapping(address => ERC20Payment) erc20payments; //  token => ERC20Payment
        Limit limit;
    }

    struct Limit {
        uint256 limit; // times, ETH or total gas amount?
        uint256 available;
        uint256 duration; // hourly, daily, weekly, or monthly in timestamp
        uint256 resetTime;
        uint256 maxFeePerGas; // The maximum fee per gas that paymaster is willing to pay for users
        uint256 maxGas; // The maximum gas that paymaster accepts for a tx.
        bool isEnabled;
    }

    struct OwnershipSponsor {
        uint256 minOwnership; // 1 or a few amounts if its NFT
        bool isERC20;
        bool isEnabled;
    }

    struct ERC20Payment {
        uint256 maxFee;
        uint256 minFee;
        uint256 discountRate; // default 0, say, can be 50% (5e17)
        bool isEnabled;
    }

    mapping(address => bool) public isValidRouter;
    mapping(address => Sponsor) public sponsors; // sponsor address => Sponsor
    uint256 public sponsorAddrCount;

    // mapping(address => Limit) public limits; // sponsor => Limit
    // mapping(address => mapping(address => OwnershipSponsor)) public ownerships; // sponsor => token => OwnershipSponsor
    // mapping(address => mapping(address => ERC20Payment)) public erc20payments; // sponsor => token => ERC20Payment
}
