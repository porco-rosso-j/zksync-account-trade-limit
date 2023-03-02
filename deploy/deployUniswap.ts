import { Wallet, utils } from 'zksync-web3';
import { ethers} from "ethers";
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { toBN } from "./utils/helper";

// Deploy function
export async function deployUniswap (
    wallet: Wallet,
    deployer: Deployer
    ):Promise<any> {

    const wethArtifact = await deployer.loadArtifact('WETH9');
    const tknArtifact = await deployer.loadArtifact('MockTKN');
    const factoryArtifact = await deployer.loadArtifact('UniswapV2Factory');
    const routerArtifact = await deployer.loadArtifact('UniswapV2Router');
    const pairArtifact = await deployer.loadArtifact('UniswapV2Pair');

   // Deploy WETH
    const weth = await deployer.deploy(wethArtifact)
    console.log(`weth: "${weth.address}",`);

   // Deploy Mock DAI
   const dai = await deployer.deploy(tknArtifact, ["DAI Stablecoin", "DAI", 18])
   console.log(`dai: "${dai.address}",`);

//    // Deploy Mock LUSD
   const lusd = await deployer.deploy(tknArtifact, ["Liquity USD", "LUSD", 18])
   console.log(`lusd: "${lusd.address}",`);

    // Deploy Factory with pair bytecode
    const pairBytecodeHash = utils.hashBytecode(pairArtifact.bytecode);
    const factory = await deployer.deploy(factoryArtifact, [wallet.address, pairBytecodeHash], undefined, [pairArtifact.bytecode])
    console.log(`factory: "${factory.address}",`)

    // Deploy Router
    const router = await deployer.deploy(routerArtifact, [factory.address, weth.address])
    console.log(`router: "${router.address}",`);

    // Instanciate Contracts
    const routerContract = new ethers.Contract(router.address, routerArtifact.abi, wallet)
    const daiContract = new ethers.Contract(dai.address, tknArtifact.abi, wallet)
    const lusdContract = new ethers.Contract(lusd.address, tknArtifact.abi, wallet)
    const wethContract = new ethers.Contract(weth.address, wethArtifact.abi, wallet)
    const factoryContract = new ethers.Contract(factory.address, factoryArtifact.abi, wallet)
    
    // Deposit ETH into WETH
    await (await wethContract.deposit({value:toBN("10000")})).wait()
    //console.log("WETH balance: ", (await wethContract.balanceOf(wallet.address)).toString())

    // Mint DAI
    await (await daiContract.mint(wallet.address, toBN("2000000"))).wait()
    //console.log("DAI balance: ", (await daiContract.balanceOf(wallet.address)).toString())

    //Mint lusd
    await (await lusdContract.mint(wallet.address, toBN("2000000"))).wait()
    //console.log("lusd balance: ", (await lusdContract.balanceOf(wallet.address)).toString())

    // Approve Router
    await (await wethContract.approve(router.address, ethers.constants.MaxUint256)).wait()
    await (await daiContract.approve(router.address, ethers.constants.MaxUint256)).wait()
    await (await lusdContract.approve(router.address, ethers.constants.MaxUint256)).wait()

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
    //console.log("WETH in Pool: ", (await wethContract.balanceOf(pair_address)).toString())
    //console.log("DAI in Pool: ", (await daiContract.balanceOf(pair_address)).toString())

    //Add Liquidity
    let tx2 = await routerContract.addLiquidity(
        weth.address,
        lusd.address, 
        toBN("500"),  // LUSD/WETH == 2000
        toBN("1000000"), 
        0,
        0, 
        wallet.address, 
        ethers.constants.MaxUint256, 
       {gasLimit: ethers.BigNumber.from(1000000)}
    )
    await tx2.wait()
    
    // const pair_address2 = await factoryContract.getPair(weth.address, lusd.address)
    //console.log("WETH in Pool: ", (await wethContract.balanceOf(pair_address2)).toString())
    //console.log("LUSD in Pool: ", (await lusdContract.balanceOf(pair_address2)).toString())

    return [wethContract, routerContract, daiContract, lusdContract]
}