import { Wallet, Contract} from 'zksync-web3';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { toBN, GASLIMIT } from "./utils/helper";

// Deploy function
export async function deployModules (
    wallet: Wallet,
    deployer: Deployer,
    routerContract:Contract,
    wethContract:Contract,
    daiContract:Contract,
    lusdContract:Contract
    ):Promise<any> {

    // Deploy Oracle
    const oracleArtifact = await deployer.loadArtifact("Oracle");
    const oracle = <Contract>(await deployer.deploy(oracleArtifact, []));
    console.log(`oracle: "${oracle.address}",`)

    // Deploy AccountRegistry
    const registryArtifact = await deployer.loadArtifact("AccountRegistry");
    const registry = <Contract>(await deployer.deploy(registryArtifact, []));
    console.log(`registry: "${registry.address}",`)

    // Deploy ModuleManager
    const moduleManagerArtifact = await deployer.loadArtifact("ModuleManager");
    const moduleManager = <Contract>(await deployer.deploy(moduleManagerArtifact, [wallet.address, registry.address]));
    console.log(`moduleManager: "${moduleManager.address}",`)

    // Deploy SwapModuleBase
    const swapmoduleBaseArtifact = await deployer.loadArtifact("SwapModuleBase");
    const swapModuleBase = <Contract>(await deployer.deploy(
        swapmoduleBaseArtifact, 
        [
        wallet.address, 
        moduleManager.address, 
        wethContract.address, 
        oracle.address, 
        toBN("5000"),
        toBN("100000")
        ]
    ));
    console.log(`swapModuleBase: "${swapModuleBase.address}",`)
    // console.log("maxTradeAmountUSD: ", (await swapModuleBase.maxTradeAmountUSD()).toString())

    // Deploy SwapModuleUniV2
    const swapmoduleArtifact = await deployer.loadArtifact("SwapModuleUniV2");
    const swapModule = <Contract>(await deployer.deploy(swapmoduleArtifact, [routerContract.address, swapModuleBase.address]));
    console.log(`swapModule: "${swapModule.address}",`)

    // Oracle: set Price: eth 1500$
    await (await oracle.setPrices(wethContract.address, toBN("1500"))).wait();
    await (await oracle.setPrices(daiContract.address, toBN("1"))).wait();
    await (await oracle.setPrices(lusdContract.address, toBN("1"))).wait();

    // ModuleManager: add Module: 
    await (await moduleManager.addModule(swapModule.address, swapModuleBase.address, GASLIMIT)).wait();

    // enable WETH and DAI and Router
    const assets = [wethContract.address, daiContract.address]
    await ( await swapModuleBase.enableAsset(assets, GASLIMIT)).wait();
    await ( await swapModuleBase.addRouter(routerContract.address, GASLIMIT)).wait();
    await ( await swapModuleBase.enabledDailyTradeLimit(toBN("10000"), GASLIMIT)).wait();
    // console.log("validAsset weth: ", await swapModuleBase.validAsset(wethContract.address))
    // console.log("validAsset dai: ", await swapModuleBase.validAsset(daiContract.address))

    return [swapModule, moduleManager, registry]
}
