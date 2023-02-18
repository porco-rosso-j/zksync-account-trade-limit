import { Wallet, Provider } from 'zksync-web3';
import { ethers} from "ethers";
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { rich_wallet } from "./utils/rich-wallet"
import { toBN } from "./utils/helper";

// Deploy function
export async function deployUniswap (hre: HardhatRuntimeEnvironment):Promise<any> {
    const provider = Provider.getDefaultProvider();
    const wallet = new Wallet(rich_wallet[0].privateKey, provider);
    const deployer = new Deployer(hre, wallet);

    const wethArtifact = await deployer.loadArtifact('WETH9');
    const daiArtifact = await deployer.loadArtifact('MockDAI');
    const factoryArtifact = await deployer.loadArtifact('UniswapV2Factory');
    const routerArtifact = await deployer.loadArtifact('UniswapV2Router');
    const pairArtifact = await deployer.loadArtifact('UniswapV2Pair');

   // Deploy WETH
    const weth = await deployer.deploy(wethArtifact)
    console.log(`weth address: ${weth.address}`);

   // Deploy Mock DAI
   const dai = await deployer.deploy(daiArtifact, ["DAI Stablecoin", "DAI", 18])
   console.log(`dai address: ${dai.address}`);

    // Deploy Factory with pair bytecode
    const factory = await deployer.deploy(factoryArtifact, [wallet.address], undefined, [pairArtifact.bytecode])
    console.log(`factory address: ${factory.address}`)

    // Deploy Router
    const router = await deployer.deploy(routerArtifact, [factory.address, weth.address])
    console.log(`router address: ${router.address}`);

    // Instanciate Contracts
    const routerContract = new ethers.Contract(router.address, routerArtifact.abi, wallet)
    const daiContract = new ethers.Contract(dai.address, daiArtifact.abi, wallet)
    const wethContract = new ethers.Contract(weth.address, wethArtifact.abi, wallet)
    const factoryContract = new ethers.Contract(factory.address, factoryArtifact.abi, wallet)
    
    // Deposit ETH into WETH
    await (await wethContract.deposit({value:toBN("1000")})).wait()
    console.log("WETH balance: ", (await wethContract.balanceOf(wallet.address)).toString())

    // Mint DAI
    await (await daiContract.mint(wallet.address, toBN("2000000"))).wait()
    console.log("DAI balance: ", (await daiContract.balanceOf(wallet.address)).toString())

    // Approve Router
    await (await wethContract.approve(router.address, ethers.constants.MaxUint256)).wait()
    await (await daiContract.approve(router.address, ethers.constants.MaxUint256)).wait()
    console.log("here?")

    // Add Liquidity
    let tx = await routerContract.addLiquidity(
        weth.address,
        dai.address, 
        toBN("500"),  // DAI/WETH == 2000
        toBN("1000000"), 
        0,
        0, 
        wallet.address, 
        ethers.constants.MaxUint256, 
       {gasLimit: ethers.BigNumber.from(1000000)}
    )
    await tx.wait()
    const pair_address = await factoryContract.getPair(weth.address, dai.address)
    console.log("pair address: ", pair_address)
    console.log("WETH in Pool: ", (await wethContract.balanceOf(pair_address)).toString())
    console.log("DAI in Pool: ", (await daiContract.balanceOf(pair_address)).toString())

    return [provider, wallet, deployer, weth.address, router.address]
}