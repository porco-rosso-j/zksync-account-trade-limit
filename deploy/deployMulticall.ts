import { Deployer } from '@matterlabs/hardhat-zksync-deploy';

// Deploy function
export async function deployMulticall (deployer: Deployer) {

    // Deploy Multicall
    const multicallArtifact = await deployer.loadArtifact('Multicall1');
    const multicall = await deployer.deploy(multicallArtifact)
    console.log(`multicall1: "${multicall.address}",`);

    // Deploy Multicall2
    const multical2Artifact = await deployer.loadArtifact('Multicall2');
    const multicall2 = await deployer.deploy(multical2Artifact)
    console.log(`multicall2: "${multicall2.address}",`);

}