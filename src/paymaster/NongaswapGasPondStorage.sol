//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.11;

abstract contract NongaswapGasPondStorage {
    address public owner;
    uint256 public constant DECIMAL_PRECISION = 1e18;

    struct Sponsor {
        uint256 sponsorId;
        uint256 ethBalance;
        mapping(address => uint256) erc20Balances;
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

    struct SwapAssetSponsor {
        bool isEnabled;
        mapping(address => bool) isSupported;
        // minimum amount
        // pair
        // ...
    }

    struct ERC20Payment {
        uint256 maxFee;
        uint256 minFee;
        uint256 discountRate; // default 0, say, can be 50% (5e17)
        bool isEnabled;
    }

    mapping(address => bool) isValidRouter;

    //mapping(uint256 => Sponsor) public sponsors;
    mapping(address => Sponsor) public sponsors;
    uint256 sponsorAddr;

    mapping(address => Limit) public limits; // sponsor => Limit
    mapping(address => SwapAssetSponsor) public swapAssetSponsors; // sponsor => SponsoredAsset
    mapping(address => mapping(address => OwnershipSponsor)) public ownerships; // sponsor => token => OwnershipSponsor
    mapping(address => mapping(address => ERC20Payment)) public erc20payments; // sponsor => token => ERC20Payment
}
