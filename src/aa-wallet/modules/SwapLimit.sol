// // SPDX-License-Identifier: MIT

// pragma solidity ^0.8.0;

// contract SwapLimit {
//     //using BytesLib for bytes;

//     uint256 public maxTradeAmountUSD;
//     uint256 public constant DAY = 864000; // a day

//     // struct AccountLimit {
//     //     uint256 available;
//     //     uint256 resetTime;
//     // }

//     // mapping(address => AccountLimit) public accountLimits;
//     mapping(address => bool) public validAsset; // router => asset => bool: determined by protocol

//     function isValidAsset(address _router, address _asset)
//         internal
//         view
//         returns (bool)
//     {
//         return validAsset[_router][_asset];
//     }

//     function _isValidTrade(address _to, bytes memory _data)
//         external
//         returns (bool)
//     {
//         require(isValidRouterAsset(_to, asset), "INVALID_ACCOUNT");
//     }

//     //     function convertEthToWeth(uint256 amount) internal {
//     //     weth.deposit{value: amount}();
//     // }

//     // function convertWethToEth(uint256 amount) internal {
//     //     weth.approve(address(this), address(weth), amount);
//     //     weth.withdraw(amount);
//     // }

//     // function isSponsoredPath(address[] memory path, address _sponsorAddr)
//     //     public
//     //     view
//     //     returns (bool)
//     // {
//     //     bool result;
//     //     for (uint256 i = 0; i < path.length; i++) {
//     //         result = isSponsoredAsset(path[i], _sponsorAddr);
//     //         if (result) return true;
//     //     }

//     //     return false;
//     // }

//     // function isSponsoredAsset(address _token, address _sponsorAddr)
//     //     public
//     //     view
//     //     returns (bool)
//     // {
//     //     Sponsor storage sponsor = sponsors[_sponsorAddr];
//     //     if (
//     //         sponsor.ethBalance >= minimumETHBalalance &&
//     //         sponsor.isSupportedSwapAsset[_token]
//     //     ) {
//     //         return true;
//     //     }
//     //     return false;
//     // }

//     // function setSponsoredSwapAsset(address[] memory _tokens) public {
//     //     require(isAccountEnabled(msg.sender), "INVALID_SPONSOR");

//     //     Sponsor storage sponsor = sponsors[msg.sender];

//     //     address token;
//     //     for (uint256 i = 0; i < _tokens.length; i++) {
//     //         token = _tokens[i];

//     //         require(token != address(0), "INVALID_ADDRESS");

//     //         if (!sponsor.isSupportedSwapAsset[token]) {
//     //             sponsor.isSupportedSwapAsset[token] = true;
//     //         }
//     //     }
//     // }

//     // function removeSponsoredSwapAsset(address _token) public {
//     //     require(isAccountEnabled(msg.sender), "INVALID_SPONSOR");

//     //     Sponsor storage sponsor = sponsors[msg.sender];

//     //     require(sponsor.isSupportedSwapAsset[_token], "NOT_SUPPORTED");
//     //     sponsor.isSupportedSwapAsset[_token] = false;
//     // }
// }
