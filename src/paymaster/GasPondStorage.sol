//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

abstract contract GasPondStorage {
    address public owner;
    uint256 public constant DECIMAL_PRECISION = 1e18;

    struct Limit {
        uint256 limit; // times, ETH or total gas amount?
        uint256 available;
        uint256 duration; // hourly, daily, weekly, or monthly in timestamp
        uint256 resetTime;
        uint256 maxFeePerGas; // The maximum fee per gas that paymaster is willing to pay for users
        uint256 maxGas; // The maximum gas that paymaster accepts for a tx.
        bool isEnabled;
    }

    struct SponcorableOwnership {
        address asset; // NFT or Governance Token
        uint256 minOwnership; // 1 or a few amounts if its NFT
        bool isEnabled;
    }

    struct SponsorableContract {
        bool isSponsoringEnabled;
        bool isFunctionSponsoringEnabled;
        mapping(address => bool) isValidContract;
        mapping(bytes4 => bool) isValidFunction;
    }

    struct SponsorableSwapToken {
        bool isEnabled;
        mapping(address => bool) isValidToken;
    }

    struct ERC20PaymentInfo {
        uint256 maxFee;
        uint256 minFee;
        uint256 discountRate; // default 0, say, can be 50% (5e17)
        bool isEnabled;
    }

    Limit public limit;
    SponcorableOwnership public ownership;
    SponsorableSwapToken public swaptokens;
    SponsorableContract public contracts;

    mapping(address => ERC20PaymentInfo) public erc20payments;
}

/*

Partial discount seems infeasible or im just not sure if its possible for both user and paymaster 
to pay half of the fee at the same time to the network. 

Otherwise, there should be a way to take users ether but paymaster accessing user address's storage slot seems no.

1: pay separately
2: user pays and paymaster refunds
3: paymaster payds and take users eth 

none of these seems possible at this point. 
Ofc yeah, i will test it but nah, shouldnt write it rn. 

For erc20, its entirely possible. 

*/
