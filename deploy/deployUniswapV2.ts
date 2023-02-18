import { utils, Wallet, Provider } from 'zksync-web3';
import { ethers, BigNumber} from "ethers";
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { rich_wallet } from "./utils/rich-wallet"

// Deploy function
export default async function (hre: HardhatRuntimeEnvironment) {
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

//    // Deploy Another ERC20
//    const _dai = await deployer.deploy(daiArtifact, ["DAI Stablecoin", "DAI", 18])
//    console.log(`_dai address: ${_dai.address}`);

    // Deploy Factory with pair bytecode
    const factory = await deployer.deploy(factoryArtifact, [wallet.address],undefined, [pairArtifact.bytecode])
    console.log(`factory address: ${factory.address}`)

    // Deploy Router
    const router = await deployer.deploy(routerArtifact, [factory.address, weth.address])
    console.log(`router address: ${router.address}`);

    // Instanciate Contracts
    const routerContract = new ethers.Contract(router.address, routerArtifact.abi, wallet)
    const daiContract = new ethers.Contract(dai.address, daiArtifact.abi, wallet)
    // const _daiContract = new ethers.Contract(_dai.address, daiArtifact.abi, wallet)
    const wethContract = new ethers.Contract(weth.address, wethArtifact.abi, wallet)
    const factoryContract = new ethers.Contract(factory.address, factoryArtifact.abi, wallet)

    // const createPairTx = await factoryContract.createPair(weth.address, dai.address, {gasLimit: ethers.BigNumber.from(2000000)})
    // await createPairTx.wait()
    // const pairAddress = await factoryContract.getPair(weth.address, dai.address);
    // console.log("pairAddress: ", pairAddress)

    // const createPairTx = await factoryContract.createPair(weth.address, dai.address, {gasLimit: ethers.BigNumber.from(2000000)})
    // await createPairTx.wait()
    // const pairAddress = await factoryContract.getPair(weth.address, dai.address);
    // console.log("pairAddress: ", pairAddress)
    
    // Deposit ETH into WETH
    await (await wethContract.deposit({value:toBN("10")})).wait()
    console.log("WETH balance: ", (await wethContract.balanceOf(wallet.address)).toString())

    // Mint DAI
    await (await daiContract.mint(wallet.address, toBN("10000"))).wait()
    console.log("DAI balance: ", (await daiContract.balanceOf(wallet.address)).toString())

    // // Mint _DAI
    // await (await _daiContract.mint(wallet.address, toBN("10000"))).wait()
    // console.log("_DAI balance: ", (await _daiContract.balanceOf(wallet.address)).toString())

    // Approve Router
    await (await wethContract.approve(router.address, ethers.constants.MaxUint256)).wait()
    await (await daiContract.approve(router.address, ethers.constants.MaxUint256)).wait()
    // await (await _daiContract.approve(router.address, ethers.constants.MaxUint256)).wait()

    // Add Liquidity
    //const timestamp = 16660938
    //const gasPrice = await provider.getGasPrice()
    let tx = await routerContract.addLiquidity(
        weth.address,
        dai.address, 
        toBN("5"),  // DAI/WETH == 2000
        toBN("10000"), 
        0,
        0, 
        wallet.address, 
        ethers.constants.MaxUint256, 
       {
        //gasPrice: gasPrice, 
        gasLimit: ethers.BigNumber.from(1500000)}
    )
    const result = await tx.wait()
    console.log("result: ", result)
    
    // tx.gasPrice = await provider.getGasPrice()
    // tx.gasLimit =  await provider.estimateGas(tx);
    // tx.customData: {
    //     ergsPerPubdata: utils.DEFAULT_ERGS_PER_PUBDATA_LIMIT
    // }
    // await provider.sendTransaction(utils.serialize(tx));    

    // console.log("token: ", tx[0])
    // console.log("eth: ", tx[1])
    // console.log("liquidity: ", restult[2].toString())
    const pair_address = await factoryContract.getPair(weth.address, dai.address)
    console.log("pair address: ", pair_address)
    console.log("WETH in Pool: ", (await wethContract.balanceOf(pair_address)).toString())
    console.log("DAI in Pool: ", (await daiContract.balanceOf(pair_address)).toString())

}


export const toBN = (x: string): BigNumber => {
    return ethers.utils.parseEther(x)
}