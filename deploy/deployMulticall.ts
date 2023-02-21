import { Wallet, Provider, utils } from 'zksync-web3';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { rich_wallet } from "./utils/rich-wallet"

// Deploy function
export async function deployMulticall (hre: HardhatRuntimeEnvironment) {

    const provider = Provider.getDefaultProvider();
    const wallet = new Wallet(rich_wallet[0].privateKey, provider);
    const deployer = new Deployer(hre, wallet);

    const multicallArtifact = await deployer.loadArtifact('Multicall');
    const multicall = await deployer.deploy(multicallArtifact)
    console.log(`multicall address: ${multicall.address}`);

}