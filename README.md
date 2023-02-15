# zksync-nongaswap

Nongaswap is a uniswapv2 fork amm with gas-sponsoring features where the followings are possible.

- Gasless swap
- Gasless swap for certain contract and functions  
  e.g. Contracts:routers or pools. Functions: `swapETHForExactTokens` and `addLiquidity`

- Gasless swap for certain assets' holders  
  e.g. ERC20: LP tokens for certain pools and governance token. NFT: POAP holders

- ERC20 gas payment with optional partial discount  
  e.g. gas payment in native governance token can be 50% discounted.
