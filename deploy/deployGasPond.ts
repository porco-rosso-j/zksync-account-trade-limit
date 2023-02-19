import { ethers} from "ethers";
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { toBN } from "./utils/helper";
import {deployUniswap} from './deployUniswap';

// yarn hardhat deploy-zksync --script deploy/deployGasPond.ts

// Deploy function
export async function deployGasPond (hre: HardhatRuntimeEnvironment) {

    const [wallet, deployer, weth_address, router_address] = await deployUniswap(hre)

    const gaspondArtifact = await deployer.loadArtifact('NongaswapGasPond');
    const gasopnd = await deployer.deploy(gaspondArtifact, [weth_address, router_address])
    console.log(`gasopnd address: ${gasopnd.address}`);

    const gasopndContract = new ethers.Contract(gasopnd.address, gaspondArtifact.abi, wallet)

    await (await gasopndContract.addRouter(router_address)).wait()
    await (await gasopndContract.registerSponsor({value:toBN("10")})).wait()

    console.log("GasPond Sponsor ETH balance: ", (await gasopndContract.getSponsorETHBalance(wallet.address)).toString())
    console.log("isValidRouter: ", (await gasopndContract.isValidRouter(router_address)))

}