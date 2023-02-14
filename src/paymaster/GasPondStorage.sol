pragma solidity 0.8.11;

abstract contract GasPondStorage {
    address public owner;
    uint256 public constant DECIMAL_PRECISION = 1e18;

    struct Limit {
        uint256 limit; // times, ETH or total gas amount?
        uint256 duration; // hourly, daily, weekly, or monthly in timestamp
        uint256 resetTime;
        uint256 available;
        uint256 maxFeePerGas; // The maximum fee per gas that paymaster is willing to pay for users
        uint256 maxGas; // The maximum gas that paymaster accepts for a tx.
        bool isEnabled;
    }

    struct SponcorableOwnership {
        address asset; // NFT or Governance Token
        uint256 minOwnership; // 1 or a few amounts if its NFT
        bool isEnabled;
    }

    struct ERC20PaymentInfo {
        uint256 minFee;
        uint256 discountRate; // default 0, say, can be 50% (5e17)
        bool isEnabled;
    }

    Limit public limit;
    SponcorableOwnership public ownership;

    bool public isContractBasedValidationEnabled;
    bool public isFunctionBasedValidationEnabled;

    mapping(address => bool) public isValidContract;
    mapping(bytes4 => bool) public isValidFunction;

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
