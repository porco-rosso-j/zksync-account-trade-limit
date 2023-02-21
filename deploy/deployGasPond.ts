import { ethers} from "ethers";
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Wallet, Provider } from 'zksync-web3';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { toBN } from "./utils/helper";
import { rich_wallet } from "./utils/rich-wallet"
import {deployUniswap} from './deployUniswap';

import { address } from "../frontend/src/common/address"

// yarn hardhat deploy-zksync --script deploy/deployGasPond.ts

// Deploy function
export default async function deployGasPond (hre: HardhatRuntimeEnvironment) {
    // const provider = Provider.getDefaultProvider();
    // const wallet = new Wallet(rich_wallet[0].privateKey, provider);
    // const deployer = new Deployer(hre, wallet);

    // const weth_address = address.weth
    // const router_address = address.router

    const [wallet, deployer, weth_address, router_address] = await deployUniswap(hre)

    // Deploy Multicall
    const multicallArtifact = await deployer.loadArtifact('Multicall');
    const multicall = await deployer.deploy(multicallArtifact)
    console.log(`multicall address: ${multicall.address}`);

    // Deploy GasPond
    const gaspondArtifact = await deployer.loadArtifact('NongaswapGasPond');
    const gasopnd = await deployer.deploy(gaspondArtifact, [weth_address, router_address])
    console.log(`gasopnd address: ${gasopnd.address}`);

    const gasopndContract = new ethers.Contract(gasopnd.address, gaspondArtifact.abi, wallet)

    await (await gasopndContract.addRouter(router_address)).wait()
    await (await gasopndContract.registerSponsor({value:toBN("10")})).wait()

    console.log("GasPond Sponsor ETH balance: ", (await gasopndContract.getSponsorETHBalance(wallet.address)).toString())
    console.log("isValidRouter: ", (await gasopndContract.isValidRouter(router_address)))

}