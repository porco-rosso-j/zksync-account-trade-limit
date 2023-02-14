## Gas Pond: Paymaster-as-a-Service

A global permissionless paymaster contract that accepts deposits from projects that want to sponsor the gas cost of their users' txs to bootstrap, folster and maintain their user-base. Not only ETH compensation but also ERC20 payment is possible.

Essentially, protocols integrate Gaspond not to offer a cheaper service but to improve UX in terms of flexibilty, comfortability and easiness so that it can attract more users and expand their service.

### Configurations for projects

- Basic: Amount, Duration, Times
- Extension: Contract-based, Function-based
- Whitelist: Offchain, Asset Holdings(NFT like POAP and Native Asset like Gov Token)
- Payment: ERC20 and NFT
- Others: Package Plans

### Business model

- Charges for projects, such as wallet, defi, nft marketplace and gamefi.
- Invest idol ETH into lending, amm and other defi to generate protocol income

### Tech stack

### subscriptin packages

#### Basic Plan

Up to 50 txs per month by 10 bucks (10 DAI)
Gas limit per tx is limited, no too much tips/bribe for operator, total ETH paid by PM should be less than xx.

#### Pro Plan

Up to 500 txs per month by 200 bucks
No limit for gas limit, no ceiling for total ETH paid by PM.

#### Annual Plan

---

wait, paymaster can be two types, two different contracts.
one is for simple gas compensation in ETH for all the projects.
the second is customizable and modularized paymaster that is deployed by each project.
So, lets first create normal paymaster that project can register.
then, next is customizable one where you can pay in ERC20 and NFT(gas ticket).
