import { utils, Wallet, Provider } from 'zksync-web3';
import { ethers, BigNumber} from "ethers";
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { rich_wallet } from "./utils/rich-wallet"
import { toBN } from "./utils/helper";
import {deployUniswap} from './deployUniswap';

// Deploy function
export default async function (hre: HardhatRuntimeEnvironment) {

    const weth_address = await deployUniswap(hre)

    const provider = Provider.getDefaultProvider();
    const wallet = new Wallet(rich_wallet[0].privateKey, provider);
    const deployer = new Deployer(hre, wallet);

    const gaspondArtifact = await deployer.loadArtifact('NongaswapGasPond');
    const gasopnd = await deployer.deploy(routerArtifact, [weth.address, weth.address])
    console.log(`router address: ${router.address}`);

    const daiContract = new ethers.Contract(dai.address, gaspondArtifact.abi, wallet)

    await (await wethContract.deposit({value:toBN("1000")})).wait()
    console.log("WETH balance: ", (await wethContract.balanceOf(wallet.address)).toString())

}