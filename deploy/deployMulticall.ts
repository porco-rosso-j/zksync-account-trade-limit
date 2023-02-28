import { Wallet, Provider, utils } from 'zksync-web3';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { rich_wallet } from "./utils/rich-wallet"

// Deploy function
export async function deployMulticall (hre: HardhatRuntimeEnvironment) {

    const provider = new Provider("http://localhost:3050", 270);;
    const wallet = new Wallet(rich_wallet[0].privateKey, provider);
    const deployer = new Deployer(hre, wallet);

    // Deploy Multicall
    const multicallArtifact = await deployer.loadArtifact('Multicall');
    const multicall = await deployer.deploy(multicallArtifact)
    console.log(`multicall: "${multicall.address}",`);

    // Deploy Multicall2
    const multical2Artifact = await deployer.loadArtifact('Multicall2');
    const multicall2 = await deployer.deploy(multical2Artifact)
    console.log(`multicall2: "${multicall2.address}",`);

}