import { ethers} from "ethers";
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Wallet, Provider, utils, Contract} from 'zksync-web3';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { toBN, GASLIMIT } from "./utils/helper";
import { rich_wallet } from "./utils/rich-wallet"
import {sendTx}  from "./utils/sendAATransaction"
import {deployUniswap} from './deployUniswap';
import {deployMulticall} from './deployMulticall';
// import {deployGasPond} from './deployGasPond';

// Deploy function
export default async function deployAccount (hre: HardhatRuntimeEnvironment) {
    const provider = new Provider("http://localhost:3050", 270);
    const wallet = new Wallet(rich_wallet[0].privateKey, provider);
    const deployer = new Deployer(hre, wallet);

    // Deploy AccountFactory
    const factoryArtifact = await deployer.loadArtifact("AccountFactory");
    const accountArtifact = await deployer.loadArtifact("Account");
    const bytecodeHash = utils.hashBytecode(accountArtifact.bytecode);

    const factory = <Contract>(await deployer.deploy(factoryArtifact, [bytecodeHash], undefined, [accountArtifact.bytecode,]));
    console.log(`aafactory: "${factory.address}",`)

    // Deploy Account  && Setup
    const salt = ethers.constants.HashZero;
    //const deployGas = await deployer.estimateDeployGas(accountArtifact, [wallet.address])
    //console.log("deployGas: ", deployGas)//, 
    const dep = await factory.deployAccount(salt, wallet.address, {gasLimit:ethers.utils.hexlify(1000000)});
    const transaction: ethers.providers.TransactionReceipt = await dep.wait();
    //const deployInfo = await utils.getDeployedContracts(transaction)
    const accountAddr = (await utils.getDeployedContracts(transaction))[0].deployedAddress
    // const AbiCoder = new ethers.utils.AbiCoder();
    // const accountAddr = utils.create2Address(
    //     factory.address,
    //     await factory.accountBytecodeHash(),
    //     salt,
    //     AbiCoder.encode(["address"], [wallet.address])
    // );
    
    const accountContract = new ethers.Contract(accountAddr, accountArtifact.abi, wallet)
    console.log(`account: "${accountContract.address}",`)

    //console.log("accountContract owner: ", await accountContract.owner())

    await (await wallet.sendTransaction({to: accountAddr, value:toBN("10")})).wait();

    // // Deploy Uniswap
    const [wethContract, routerContract, daiContract] = await deployUniswap(hre)
    await deployMulticall(hre)
    //await deployGasPond(hre, wethContract.address, routerContract.address)

    // Deploy Oracle
    const oracleArtifact = await deployer.loadArtifact("Oracle");
    const oracle = <Contract>(await deployer.deploy(oracleArtifact, []));
    console.log(`oracle: "${oracle.address}",`)

    // set Price: eth 1500$
    await (
        await oracle.setPrices(wethContract.address, toBN("1500"))
    ).wait();

    // Deploy SwapModuleBase
    const swapmoduleBaseArtifact = await deployer.loadArtifact("SwapModuleBase");
    const swapModuleBase = <Contract>(await deployer.deploy(swapmoduleBaseArtifact, [wallet.address, oracle.address, toBN("10000")]));
    console.log(`swapModuleBase: "${swapModuleBase.address}",`)
    // console.log("maxTradeAmountUSD: ", (await swapModuleBase.maxTradeAmountUSD()).toString())

    // enable WETH and DAI and Router
    const assetes = [wethContract.address, daiContract.address]
    await ( await swapModuleBase.enableAsset(assetes)).wait();
    await ( await swapModuleBase.addRouter(routerContract.address)).wait();
    // console.log("validAsset weth: ", await swapModuleBase.validAsset(wethContract.address))
    // console.log("validAsset dai: ", await swapModuleBase.validAsset(daiContract.address))

    // Deploy SwapModuleUniV2
    const swapmoduleArtifact = await deployer.loadArtifact("SwapModuleUniV2");
    const swapModule = <Contract>(await deployer.deploy(swapmoduleArtifact, [routerContract.address, swapModuleBase.address]));
    console.log(`swapModule: "${swapModule.address}",`)


    //Account Setting
    let tx = await accountContract.populateTransaction.addModule(swapModule.address, swapModuleBase.address);
    const txReceipt = await sendTx(provider, accountContract, wallet, tx)
    await txReceipt.wait()

    //console.log("isAccountEnabled: ", await swapModuleBase.isAccountEnabled(accountContract.address))

    // check trade size
    //const amountIn = toBN("1")
    //console.log("trade size: ", await swapModuleBase.tradeSize(wethContract.address, amountIn))

    // Swap
    // const path = [wethContract.address, daiContract.address]
    // let tx1 = await swapModule.populateTransaction.swapETHForToken(amountIn, path);
    // const txReceipt1 = await sendTx(provider, accountContract, wallet, tx1)
    // await txReceipt1.wait()

    //console.log("dai balance in account: ", (await daiContract.balanceOf(accountContract.address)).toString())
}


/*
    await(await routerContract.swapExactETHForTokens(
        ethers.BigNumber.from(0), 
        path, 
        wallet.address,
        ethers.constants.MaxUint256,
        {value:ethers.utils.parseEther("1"), gasLimit: ethers.utils.hexlify(1000000)}
    )).wait()

    console.log("dai balance in account: ", (await daiContract.balanceOf(wallet.address)).toString())

    // let tx1 = await swapModule.populateTransaction.depositWETH(wethContract.address, ethers.utils.parseEther("1"));
    // const txReceipt1 = await sendTx(provider, accountContract, wallet, tx1)
    // await txReceipt1.wait()

    // console.log("weth balance in account: ", (await wethContract.balanceOf(accountContract.address)).toString())

        let tx1 = await swapModule.populateTransaction.depositWETH(wethContract.address, ethers.utils.parseEther("1"));
    const txReceipt1 = await sendTx(provider, accountContract, wallet, tx1)
    const result = await txReceipt1.wait() // gasUsed: 130058

    console.log("result; ", result)
    console.log("weth balance in account: ", (await wethContract.balanceOf(accountContract.address)).toString())
*/