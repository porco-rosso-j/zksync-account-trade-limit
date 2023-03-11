# Account Trade Limit

## Overview

This project implements an Account Abstraction wallet contract with multiple unique features: swap & trade size limit, multicall, and meta-transaction via paymaster. 

Contract: [`Account.sol`](https://github.com/porco-rosso-j/zksync-account-trade-limit/blob/5903181b50b369df3d22de9e3501cd16075bbf09/src/aa-wallet/Account.sol) & [`AccountFacotory.sol`](https://github.com/porco-rosso-j/zksync-account-trade-limit/blob/5903181b50b369df3d22de9e3501cd16075bbf09/src/aa-wallet/AccountFactory.sol)

## Account Trade Limit & Swap Module

Modules serve as peripheral helpers and give them extensional functionalities and protective limitations. This project has a module called SwapModule that allows accounts to swap tokens on AMM DEX with limitations such as token whitelist, the daily trade size limit, and maximum size per trade. This module is recommended for non-veteran users who ought to trade crypto assets as conservatively as possible. 

### SwapModule

Contracts: [`SwapModuleUniV2.sol`](https://github.com/porco-rosso-j/zksync-account-trade-limit/blob/main/src/aa-wallet/modules/swapModule/SwapModuleUnV2.sol) & [`SwapModuleBase.sol`](https://github.com/porco-rosso-j/zksync-account-trade-limit/blob/main/src/aa-wallet/modules/swapModule/SwapModuleBase.sol)

- SwapModuleUniV2 is an executor, delegatecalled from Account and executes swap methods on an UniswapV2's router contract.
- SwapModuleBase is a base for executors, being in charge of all the validations logic and storing variables.

The rationale for deploying SwapModuleBase separately is that 1) with delegatecall, variables stored in SwapModuleUniV2 can't be read and used for validation logics, and 2) SwapModuleBase should serve as a single base/helper for multiple executors since SwapModule can integrate multiple DEXs by deploying new executors contracts.

## GasPond(Paymaster)

Contract: [`GasPond.sol`](https://github.com/porco-rosso-j/zksync-account-trade-limit/blob/main/src/aa-wallet/paymaster/GasPond.sol)  

A Paymaster contract called GasPond allows both free transactions and gas payments in ERC20 for accounts. GasPond also supports accounts' transactions via modules such as SwapModule if enabled. 

### Sponsor Model

GasPond employs the sponsor model instead of the general paymaster model, meaning that the deployer/owner of the GasPond contract isn't a "paymaster" who compensates gas costs and accepts ERC20 gas payments. Rather GasPond is a Paymaster-as-a-Service: any individual and project can become a sponsor on GasPond to sponsor users with easy registration, ETH deposit, and configurations.

This model could drastically reduce the cost of providing meta-transactions so that crypto services can improve the UX of their products more easily. Additionally, users don't have to rely on multiple different paymaster contracts where vulnerabilities and malicious bugs might exist.

#### An example of the use of GasPond for a project
A project called XYZinc becomes a sponsor on GasPond to get more trading volume and awareness for their native token XYZ. As such, for purchases of XYZ tokens on DEXs supported by SwapModule, it accepts gas payments paid in XYZ with a 50% discount. 


## Multicall

Contract: [`Multicall`](https://github.com/porco-rosso-j/zksync-account-trade-limit/blob/main/src/aa-wallet/libraries/Multicall.sol)

Account inherits Multicall contract that allows the account to perform both call and delegatecall in the same transaction. It also supports call/delegatecall for module contracts so that the account can combine any arbitrary logic with methods in external contracts. For example, 1) approve tx to an ERC20 token 2) swap tx via SwapModule. 

## Demo

## Deployment
