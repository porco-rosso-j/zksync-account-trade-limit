import { Wallet, Contract, utils } from "zksync-web3";
import * as hre from "hardhat";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { BigNumber, ethers } from "ethers";

export async function getERC20Contract(address:string, wallet:Wallet):Promise<Contract> {
    const lptokenArtifact = await hre.artifacts.readArtifact("UniswapV2ERC20");
    return new Contract(address, lptokenArtifact.abi, wallet)
}

export async function deployUniswapERC20(wallet: Wallet, TOTAL_SUPPLY: BigNumber): Promise<Contract> {
    const factory = await deployUniswapFactory(wallet)
    const router = await deployRouter(wallet, factory)
    const token0 = await deployMockTKN(wallet, "", "", 18)
    const token1 = await deployMockTKN(wallet, "", "", 18)

    await (await token0.mint(wallet.address, TOTAL_SUPPLY)).wait()
    await (await token1.mint(wallet.address, TOTAL_SUPPLY)).wait()
    await (await token0.approve(router.address, ethers.constants.MaxUint256)).wait()
    await (await token1.approve(router.address, ethers.constants.MaxUint256)).wait()

    // Add Liquidity
    let tx = await router.addLiquidity(
        token0.address,
        token1.address, 
        TOTAL_SUPPLY,  
        TOTAL_SUPPLY,
        0,
        0, 
        wallet.address, 
        ethers.constants.MaxUint256, 
       {gasLimit: ethers.BigNumber.from(1000000)}
    )
    await tx.wait()

    const pairAddress = await factory.getPair(token0.address, token1.address)
    const lptokenArtifact = await hre.artifacts.readArtifact("UniswapV2ERC20");
    const lpTokenContract = new Contract(pairAddress, lptokenArtifact.abi, wallet)

    return lpTokenContract
}

export async function deployPair(wallet:Wallet, TOTAL_SUPPLY: BigNumber): Promise<Contract> {
    const LPtoken = await deployUniswapERC20(wallet, TOTAL_SUPPLY)
    const pairArtifact = await hre.artifacts.readArtifact("UniswapV2Pair");
    const pair = new Contract(LPtoken.address, pairArtifact.abi, wallet)
    return pair
}

export async function deployRouter(wallet:Wallet, factory: Contract): Promise<Contract> {
    let deployer:Deployer = new Deployer(hre, wallet);
    const routerArtifact = await deployer.loadArtifact("UniswapV2Router");
    const weth = await deployWETH(wallet)
    return (await deployer.deploy(routerArtifact, [factory.address, weth.address]))
}

export async function deployRouterWithWETH(wallet:Wallet, factory: Contract, weth:Contract): Promise<Contract> {
    let deployer:Deployer = new Deployer(hre, wallet);
    const routerArtifact = await deployer.loadArtifact("UniswapV2Router");
    return (await deployer.deploy(routerArtifact, [factory.address, weth.address]))
}

export async function deployWETH(wallet:Wallet): Promise<Contract> {
    let deployer:Deployer = new Deployer(hre, wallet);
    const wethArtifact = await deployer.loadArtifact("WETH9");
    return await deployer.deploy(wethArtifact, [])
}

export async function deployMockTKN(wallet:Wallet, name:string, symbol:string, decimal:number): Promise<Contract> {
    let deployer:Deployer = new Deployer(hre, wallet);
    const tknArtifact = await deployer.loadArtifact("MockTKN");
    return await deployer.deploy(tknArtifact, [name, symbol, decimal])
}

export async function deployERC20(wallet:Wallet, initialSupply:BigNumber): Promise<Contract> {
    let deployer:Deployer = new Deployer(hre, wallet);
    const erc20Artifact = await deployer.loadArtifact("ERC20Mock");
    return await deployer.deploy(erc20Artifact, [initialSupply])
}

export async function mintTKN(wallet:Wallet, token:Contract, amount:BigNumber) {
    await (await token.mint(wallet.address, amount,  {gasLimit: ethers.BigNumber.from(1000000)})).wait()
}

export async function deployUniswapFactory(wallet: Wallet): Promise<Contract> {
    let deployer:Deployer = new Deployer(hre, wallet);
    const factoryArtifact = await deployer.loadArtifact("UniswapV2Factory");
    const pairArtifact = await deployer.loadArtifact("UniswapV2Pair");
    const pairBytecodeHash = utils.hashBytecode(pairArtifact.bytecode);
  
    return await deployer.deploy(factoryArtifact, [wallet.address, pairBytecodeHash], undefined, [pairArtifact.bytecode]);
}

export async function getFactoryContract(address:string, wallet:Wallet):Promise<Contract> {
    const factoryArtifact = await hre.artifacts.readArtifact("UniswapV2Factory");
    return new Contract(address, factoryArtifact.abi, wallet)
}

export async function getPairByteCode(wallet:Wallet):Promise<string> {
    const deployer:Deployer = new Deployer(hre, wallet);
    const pairArtifact = await deployer.loadArtifact("UniswapV2Pair");
    return pairArtifact.bytecode;
}

export async function deployUniswapPair(wallet:Wallet, factory:Contract, tokens:string[]):Promise<Contract> {
    await (await factory.createPair(tokens[0], tokens[1])).wait()
    const pairAddr = await factory.callStatic.getPair(tokens[0], tokens[1])
    const pairArtifact = await hre.artifacts.readArtifact("UniswapV2Pair");
    return new Contract(pairAddr, pairArtifact.abi, wallet)
}

export async function _createPair(factory:Contract, token0:string, token1:string):Promise<any> {
    return await factory.createPair(token0, token1, {gasLimit: ethers.BigNumber.from(1000000)})
}

export async function getPairContract(address:string, wallet:Wallet):Promise<Contract> {
    const deployer:Deployer = new Deployer(hre, wallet);
    const pairArtifact = await deployer.loadArtifact("UniswapV2Pair");
    return new Contract(address, pairArtifact.abi, wallet)
}

export async function deployRouterEmiter(wallet:Wallet):Promise<Contract> {
    const deployer:Deployer = new Deployer(hre, wallet);
    const routerEmitterArtifact = await deployer.loadArtifact("RouterEventEmitter");
    return await deployer.deploy(routerEmitterArtifact, [])
}


/// Contract Getters

// export async function getContractFactory(address:string, name: string, signer: Wallet,): Promise<Contract> {
//     return new Contract();
// }