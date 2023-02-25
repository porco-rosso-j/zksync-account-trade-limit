import { ethers} from "ethers";
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Wallet, Provider } from 'zksync-web3';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { toBN } from "./utils/helper";
import { rich_wallet } from "./utils/rich-wallet"
import {deployUniswap} from './deployUniswap';
import {deployMulticall} from './deployMulticall';
import { address } from "../frontend/src/common/address"

// yarn hardhat deploy-zksync --script deploy/deployGasPond.ts

// Deploy function
export default async function deployGasPond (hre: HardhatRuntimeEnvironment) {
    const provider = new Provider("http://localhost:3050");
    const wallet = new Wallet(rich_wallet[0].privateKey, provider);
    const deployer = new Deployer(hre, wallet);

    // const weth_address = address.weth
    // const router_address = address.router

    const [weth_address, router_address] = await deployUniswap(hre)
    await deployMulticall(hre)

    // Deploy GasPond
    const gaspondArtifact = await deployer.loadArtifact('NongaswapGPV2');
    const gasopnd = await deployer.deploy(gaspondArtifact, [weth_address, router_address])
    console.log(`gaspond: "${gasopnd.address}",`);

    const gasopndContract = new ethers.Contract(gasopnd.address, gaspondArtifact.abi, wallet)

    // Config GasPond
    await (await gasopndContract.addRouter(router_address)).wait()
    await (await gasopndContract.registerSponsor({value:toBN("10")})).wait()
    await (await gasopndContract.setSponsoredSwapAsset([weth_address])).wait()

    console.log("GasPond Sponsor ETH balance: ", (await gasopndContract.getSponsorETHBalance(wallet.address)).toString())
    console.log("isValidRouter: ", (await gasopndContract.isValidRouter(router_address)))
    console.log("isSponsoredPath DAI-WETH:" ,  (await gasopndContract.isSponsoredPath([address.dai, weth_address], wallet.address)))
    console.log("isSponsoredPath LUSD-WETH:" ,  (await gasopndContract.isSponsoredPath([address.lusd, weth_address], wallet.address)))
    console.log("isSponsoredPath LUSD-DAI:" ,  (await gasopndContract.isSponsoredPath([address.lusd, weth_address, address.dai], wallet.address)))

}