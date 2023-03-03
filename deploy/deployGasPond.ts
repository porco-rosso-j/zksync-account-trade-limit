import { ethers} from "ethers";
import { Wallet, Contract } from 'zksync-web3';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { toBN } from "./utils/helper";

export async function deployGasPond (
    wallet: Wallet,
    deployer: Deployer,
    wethContract:Contract, 
    routerContract:Contract, 
    daiContract:Contract,
    swapModule:Contract,
    moduleManager:Contract
    ) {
    
    // Deploy GasPond
    const gaspondArtifact = await deployer.loadArtifact('GasPond');
    const gasopnd = await deployer.deploy(gaspondArtifact, [wethContract.address, routerContract.address, moduleManager.address])
    // const gasopnd = await deployer.deploy(gaspondArtifact, [
    //     "0xc441A51e24f90aE9cA92C9d59A5Af2c3C6D5b0a7", 
    //     "0xa4dA77909d77915d98F1c17e281Fa053E3052f40", 
    //     "0xf8F54D9ffa6C6dd718F65054Ec795465cD978eae"
    // ])
    console.log(`gaspond: "${gasopnd.address}",`);
    const gasopndContract = new ethers.Contract(gasopnd.address, gaspondArtifact.abi, wallet)

    // Config GasPond
    await (await gasopndContract.addModule(1)).wait()
    await (await gasopndContract.registerSponsor({value:toBN("10")})).wait();
    await (await gasopndContract.enableSponsoringModules([swapModule.address])).wait();
    //await (await gasopndContract.enableSponsoringModules(["0x22d9Db989968296087f4A2aEA3203374FeD07704"])).wait();
    await (await gasopndContract.setERC20PaymentInfo(
       daiContract.address,
       //"0x68e0b134A32516beF4d3baeEDc5bF1067bfADC49",
        toBN("100"), // maxFee: 100 dai
        toBN("0"), // minFee: 0 dai
        toBN("0") // discountRate: 0 %
    )).wait();

    // console.log("GasPond Sponsor ETH balance: ", (await gasopndContract.getSponsorETHBalance(wallet.address)).toString())
    // console.log("isValidRouter: ", (await gasopndContract.isValidRouter(router_address)))
    // console.log("isSponsoredPath DAI-WETH:" ,  (await gasopndContract.isSponsoredPath([address.dai, weth_address], wallet.address)))
    // console.log("isSponsoredPath LUSD-WETH:" ,  (await gasopndContract.isSponsoredPath([address.lusd, weth_address], wallet.address)))
    // console.log("isSponsoredPath LUSD-DAI:" ,  (await gasopndContract.isSponsoredPath([address.lusd, weth_address, address.dai], wallet.address)))

}