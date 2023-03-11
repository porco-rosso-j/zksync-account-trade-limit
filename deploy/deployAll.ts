import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Wallet, Provider } from 'zksync-web3';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { rich_wallet } from "./utils/rich-wallet"

import { deployUniswap } from "./deployUniswap";
import { deployMulticall } from "./deployMulticall";
import { deployModules } from "./deployModules";
import { deployGasPond } from "./deployGasPond";
import { deployAccount } from "./deployAccount";

// yarn hardhat deploy-zksync --script deploy/deployAll.ts

// Deploy function
export default async function deployAll (hre: HardhatRuntimeEnvironment) {
    const provider = new Provider("http://localhost:3050", 270);
    const wallet = new Wallet(rich_wallet[0].privateKey, provider);
    const deployer = new Deployer(hre, wallet);
    
   const[
    wethContract, 
    routerContract, 
    daiContract, 
    lusdContract
   ] = await deployUniswap(wallet, deployer)

   const[swapModule, moduleManager, registry] 
   = await deployModules(
    wallet, 
    deployer,
    routerContract,
    wethContract,
    daiContract,
    lusdContract
    )

    await deployAccount(
        wallet, 
        deployer, 
        daiContract, 
        moduleManager,
        registry
    )

    await deployGasPond(
        wallet, 
        deployer, 
        wethContract, 
        routerContract, 
        daiContract, 
        swapModule,
        moduleManager
    )

    await deployMulticall(deployer)

}