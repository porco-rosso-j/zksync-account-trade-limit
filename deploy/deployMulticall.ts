import { Wallet, Provider } from 'zksync-web3';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { rich_wallet } from "./utils/rich-wallet"

// Deploy function
export default async function deployMulticall (hre: HardhatRuntimeEnvironment) {

    const provider = Provider.getDefaultProvider();
    const wallet = new Wallet(rich_wallet[0].privateKey, provider);
    const deployer = new Deployer(hre, wallet);

    const multicallArtifact = await deployer.loadArtifact('Multicall');
    const multicall = await deployer.deploy(multicallArtifact)
    console.log(`gasopnd address: ${multicall.address}`);

    // const gasopndContract = new ethers.Contract(gasopnd.address, gaspondArtifact.abi, wallet)

    // await (await gasopndContract.addRouter(router_address)).wait()
    // await (await gasopndContract.registerSponsor({value:toBN("10")})).wait()

    // console.log("GasPond Sponsor ETH balance: ", (await gasopndContract.getSponsorETHBalance(wallet.address)).toString())
    // console.log("isValidRouter: ", (await gasopndContract.isValidRouter(router_address)))

}