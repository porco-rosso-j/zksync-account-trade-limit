# Account Trade Limit

This repo is a submission to the [zkSync Era Hack0 on buidlBox](https://app.buidlbox.io/zksync/era-hack-series)

<p align="center">
<img width="1000" alt="Screen Shot 2023-03-11 at 17 46 38" src="https://user-images.githubusercontent.com/88586592/224474754-7c02a7f4-75de-4e6f-bff1-3113c5d7b095.png">
</p>

## Overview

This project implements an Account Abstraction wallet contract with multiple unique features: swap & trade size limit, multicall, and meta-transaction via paymaster.

Contract: [`Account.sol`](https://github.com/porco-rosso-j/zksync-account-trade-limit/blob/5903181b50b369df3d22de9e3501cd16075bbf09/src/aa-wallet/Account.sol) & [`AccountFacotory.sol`](https://github.com/porco-rosso-j/zksync-account-trade-limit/blob/5903181b50b369df3d22de9e3501cd16075bbf09/src/aa-wallet/AccountFactory.sol)

## Account Trade Limit & Swap Module

Modules serve as peripheral helpers and give AA-accounts extensional functionalities and protective limitations. This project has a module called SwapModule that allows accounts to swap tokens on AMM DEX with limitations such as token whitelist, daily trade size limit, and maximum size per trade. This module is recommended for non-veteran users who ought to trade crypto assets as conservatively as possible.

### SwapModule

Contracts: [`SwapModuleUniV2.sol`](https://github.com/porco-rosso-j/zksync-account-trade-limit/blob/main/src/aa-wallet/modules/swapModule/SwapModuleUnV2.sol) & [`SwapModuleBase.sol`](https://github.com/porco-rosso-j/zksync-account-trade-limit/blob/main/src/aa-wallet/modules/swapModule/SwapModuleBase.sol)

- SwapModuleUniV2 is an executor, delegatecalled from Account and executes swap methods on an UniswapV2's router contract.
- SwapModuleBase is a base for executors, being in charge of all the validations logic and storing variables.

The rationale for deploying SwapModuleBase separately is that 1) with delegatecall, variables stored in SwapModuleUniV2 can't be read and used for validation logics, and 2) SwapModuleBase should serve as a single base for multiple executors since SwapModule can integrate multiple DEXs by deploying new executors contracts.

## GasPond(Paymaster)

Contract: [`GasPond.sol`](https://github.com/porco-rosso-j/zksync-account-trade-limit/blob/main/src/aa-wallet/paymaster/GasPond.sol)

A Paymaster contract called GasPond allows both free transactions and gas payments in ERC20 for accounts. GasPond also supports accounts' transactions via modules such as SwapModule if enabled.

### Sponsor Model

GasPond employs the sponsor model instead of the general paymaster model, meaning that the deployer/owner of the GasPond contract isn't a "paymaster" who compensates gas costs and accepts ERC20 gas payments. Rather, GasPond is a Paymaster-as-a-Service: any individual and project can become a sponsor on GasPond to sponsor users with easy registration, ETH deposit, and configurations.

This model could drastically reduce the cost of providing meta-transactions so that crypto services can improve the UX of their products more easily. Additionally, users don't have to rely on multiple different paymaster contracts where vulnerabilities and malicious bugs might exist.

### An example of the use of GasPond for a project

A project called XYZinc becomes a sponsor on GasPond, aiming to increase trading activities and awareness of their native token XYZ. As such, for purchases of XYZ tokens on DEXs supported by SwapModule, it accepts gas payments paid in XYZ with a 50% discount.

## Multicall

Contract: [`Multicall`](https://github.com/porco-rosso-j/zksync-account-trade-limit/blob/main/src/aa-wallet/libraries/Multicall.sol)

Account inherits Multicall contract that allows the account to perform both call and delegatecall in the same transaction. It also supports call/delegatecall to module contracts so that the account can combine any arbitrary logic in modules with methods in external contracts.

For example, 1) approve tx to an ERC20 token 2) swap tx via SwapModule.

## Demo

The demo below shows how it looks like to swap DAI for ETH on DEX UI.

1. Connect the deployed account contract with the Swap UI.
2. Check several limitations that SwapModule imposes on Account: Token whitelist, Max size per trade and Daily trade limit.
3. Swap DAI for ETH ( gas fee paid in DAI via GasPond ) by signing for EIP712 transaction with Metamask.

https://user-images.githubusercontent.com/88586592/224517521-52d24b7a-de5a-43c2-a3a6-b4f6399f9283.mp4

## Deployment

Deploy and configure all the contracts on zkSync local network and try features available with Account Abstraction Wallet and its module. 

### Setup & Install dependencies

```shell
git clone git@github.com:porco-rosso-j/zksync-account-trade-limit.git
cd zksync-account-trade-limit
yarn
```

### Run zkSync local network

To set up a local environment, Docker and docker-compose should be installed.
If they are not installed on your computer: [Install](https://docs.docker.com/get-docker/).

```shell
git clone https://github.com/matter-labs/local-setup.git
cd local-setup
./start.sh
```

### Compile & Deploy contracts

Before, create `.env` file and add the line `NODE_ENV="local"`.

```shell
yarn hardhat compile
yarn hardhat deploy-zksync --script deploy/deployAll.ts
```

The deploy script above deploys the all necessary contracts and carry out initialization/configuration for each contract. For more details on how the deployment proceeds, look [`./deploy/..`](https://github.com/porco-rosso-j/zksync-account-trade-limit/tree/main/deploy) folder.

The output would look like the following.

```shell
weth: "0xD49036D56f474152891D9eced770D6b90B2cEAE9",
dai: "0xb1Ca5B44ef3627A3E5Ed7a6EE877D9D997A7c7ED",
lusd: "0x7AddC93ED39C4c64dffB478999B45f5a40619C23",
factory: "0xd19449266F443e67175e7669be788F94ca6e886e",
router: "0x13706Afd344d905BB9Cb50752065a67Fa8d09c70",
oracle: "0x4cf2E778D384746EaB115b914885e2bB18E893E2",
registry: "0xb47A53D7f201A7F4CA6FDBd1Efb083A041713101",
moduleManager: "0xd5608cEC132ED4875D19f8d815EC2ac58498B4E5",
swapModuleBase: "0x5A6be02aC21339d38cF0682A77bb24D858902246",
swapModule: "0xB3A273E27D718aadAa7895Ee0eD5B61e89219543",
aafactory: "0xE13BFf7F138853F7c33e6824Ea102D8b5cFe6bC8",
account: "0xD118052dF04aA7af089303a5889D2cE2F205627F",
gaspond: "0xdaa47000ab1013592C87c0FCf349aBE90178d2B8",
multicall1: "0xcFEbe41427dB860B7760507f50F39370e27e9D61",
multicall2: "0x8A1215E77D2ea1ce759a6bB0366870B21548F502",
```

Copy & paste all these deployed addresses into [`address.ts`](https://github.com/porco-rosso-j/zksync-account-trade-limit/blob/main/frontend/src/common/address.ts) and only the three of token addresses into [`tokenlist.json`](https://github.com/porco-rosso-j/zksync-account-trade-limit/blob/main/frontend/src/components/Modal/token_list.json).

### Setup & Run frontend

```shell
cd frontend
yarn
yarn start
```

### Connect Wallet & Account

Put the deployed account address (`0xD1180...`) into the field below `"Connect With Contract Account"` button and click it. If successuful, the connnected address on UI will be the account address.

<p align="center">
<img width="500" alt="Screen Shot 2023-03-12 at 7 35 06" src="https://user-images.githubusercontent.com/88586592/224514450-c43ba27d-68be-4e6b-b6df-2f0307abc6b1.png">
<p/>

After the AA-wallet is connected, the information of Account trade Limit will be shown under the swap button.

<p align="center">
<img width="500" alt="Screen Shot 2023-03-12 at 7 50 45" src="https://user-images.githubusercontent.com/88586592/224514906-22739ff8-ff94-4dde-a087-ad1a5e7909e7.png">
<p/>

And please put the amount you want to swap. As you can see in the demo above, several limitations and warnings by SwapModule will be shown in `Account Trade Limit` section. Swap succeeds unless it violates those imposed restrictions.

Account only owns DAI, neither ETH, WETH nor LUSD. But swapping DAI for ETH will succeed because multicall feature abstracts the approval process and gas fee is paid in DAI through GasPond.

## Question & Feedback

Discord: Porco#3106  
Twitter: [@porco_rosso_j](https://twitter.com/porco_rosso_j)
