import { BytesLike, ethers, BigNumber } from "ethers";
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Wallet, Provider, Contract, utils } from 'zksync-web3';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { rich_wallet } from "./utils/rich-wallet"

export default async function (hre: HardhatRuntimeEnvironment) {
    
    const provider = new Provider("http://localhost:3050", 270);;
    const wallet = new Wallet(rich_wallet[0].privateKey, provider);
    const deployer = new Deployer(hre, wallet);

    const libtestArtifact = await deployer.loadArtifact('LibTest');
    const libtest = <Contract>(await deployer.deploy(libtestArtifact, []))

    console.log("test result: ", (await libtest.Add(BigNumber.from(20000000), BigNumber.from(3000000000))).toString())
}