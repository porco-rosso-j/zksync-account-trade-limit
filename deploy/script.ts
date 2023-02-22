import { ethers} from "ethers";
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Wallet, Provider } from 'zksync-web3';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { toBN } from "./utils/helper";
import { rich_wallet } from "./utils/rich-wallet"

import { address } from "../frontend/src/common/address"

export default async function (hre: HardhatRuntimeEnvironment) {
    const provider = Provider.getDefaultProvider();
    const wallet = new Wallet(rich_wallet[0].privateKey, provider);
    const deployer = new Deployer(hre, wallet);

    // const gaspondArtifact = await deployer.loadArtifact('NongaswapGasPond');
    // const gasopndContract = new ethers.Contract(address.gaspond, gaspondArtifact.abi, wallet)

    // const ethbalance = await gasopndContract.getSponsorETHBalance(wallet.address)
    // console.log("balance: ", ethbalance.toString())

    const wethArtifact = await deployer.loadArtifact('WETH9');
    const wethContract = new ethers.Contract(address.weth, wethArtifact.abi, wallet)

    await(await wethContract.deposit({value:toBN("10")}))
    console.log("depoisted")

    await(await wethContract.withdraw(toBN("5")))
    console.log("withdrawn")
}