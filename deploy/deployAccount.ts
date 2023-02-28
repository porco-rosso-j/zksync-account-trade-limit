import { ethers} from "ethers";
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Wallet, Provider, utils, Contract} from 'zksync-web3';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { GASLIMIT } from "./utils/helper";
import { rich_wallet } from "./utils/rich-wallet"
import {sendTx}  from "./utils/sendAATransaction"
import {deployUniswap} from './deployUniswap';

// Deploy function
export default async function deployAccount (hre: HardhatRuntimeEnvironment) {
    const provider = new Provider("http://localhost:3050");
    const wallet = new Wallet(rich_wallet[0].privateKey, provider);
    const deployer = new Deployer(hre, wallet);

    // Deploy AccountFactory
    const factoryArtifact = await deployer.loadArtifact("AccountFactory");
    const accountArtifact = await deployer.loadArtifact("Account");
    // const _accountArtifact = await deployer.loadArtifact("TwoUserMultisig");
    const bytecodeHash = utils.hashBytecode(accountArtifact.bytecode);

    const factory = <Contract>(await deployer.deploy(factoryArtifact, [bytecodeHash], undefined, [accountArtifact.bytecode,]));
    console.log("AccountFactory address: ", factory.address);

    // Deploy Account  && Setup
    const salt = ethers.constants.HashZero;
    const deployGas = await deployer.estimateDeployGas(accountArtifact, [wallet.address])
    console.log("deployGas: ", deployGas)
    const transaction = await(await factory.deployAccount(salt, wallet.address, GASLIMIT)).wait();
    const accountAddr = (await utils.getDeployedContracts(transaction))[0].deployedAddress
    console.log("account deployed on: ",accountAddr)

    const accountContract = new ethers.Contract(accountAddr, accountArtifact.abi, wallet)

    console.log("accountContract owner: ", await accountContract.owner())

    await (
        await wallet.sendTransaction({
            to: accountAddr,
            value: ethers.utils.parseEther("10")
        })
    ).wait();

    // // Deploy Uniswap
    const [wethContract, routerContract, daiContract] = await deployUniswap(hre)
    // await deployMulticall(hre)
    // const router_address = "0xa9e6018dCCC40cc30568ea051169512FEb230DeF"

    // Deploy Oracle
    const oracleArtifact = await deployer.loadArtifact("Oracle");
    const oracle = <Contract>(await deployer.deploy(oracleArtifact, []));
    console.log("oracle: ", oracle.address)

    // set Price: eth 1500$
    await (
        await oracle.setPrices(wethContract.address, ethers.utils.parseEther("1500"))
    ).wait();

    // Deploy SwapModuleBase
    const swapmoduleBaseArtifact = await deployer.loadArtifact("SwapModuleBase");
    const swapModuleBase = <Contract>(await deployer.deploy(swapmoduleBaseArtifact, [wallet.address, oracle.address, ethers.utils.parseEther("10000")]));
    console.log("swapModuleBase: ", swapModuleBase.address)
    console.log("maxTradeAmountUSD: ", (await swapModuleBase.maxTradeAmountUSD()).toString())

    // enable WETH and DAI and Router
    const assetes = [wethContract.address, daiContract.address]
    await ( await swapModuleBase.enableAsset(assetes)).wait();
    await ( await swapModuleBase.addRouter(routerContract.address)).wait();
    console.log("validAsset weth: ", await swapModuleBase.validAsset(wethContract.address))
    console.log("validAsset dai: ", await swapModuleBase.validAsset(daiContract.address))

    // Deploy SwapModuleUniV2
    const swapmoduleArtifact = await deployer.loadArtifact("SwapModuleUniV2");
    const swapModule = <Contract>(await deployer.deploy(swapmoduleArtifact, [routerContract.address, swapModuleBase.address]));
    console.log("swapModule: ", swapModule.address)

    //Account Setting
    let tx = await accountContract.populateTransaction.addModule(swapModule.address, swapModuleBase.address);
    const txReceipt = await sendTx(provider, accountContract, wallet, tx)
    await txReceipt.wait()

    console.log("isAccountEnabled: ", await swapModuleBase.isAccountEnabled(accountContract.address))

    // check trade size
    const amountIn = ethers.utils.parseEther("1")
    console.log("trade size: ", await swapModuleBase.tradeSize(wethContract.address, amountIn))

    // Swap
    const path = [wethContract.address, daiContract.address]
    let tx1 = await swapModule.populateTransaction.swapETHForToken(amountIn, path);
    const txReceipt1 = await sendTx(provider, accountContract, wallet, tx1)
    await txReceipt1.wait()

    console.log("dai balance in account: ", (await daiContract.balanceOf(accountContract.address)).toString())


    // account -> swapModule -> weth
    // proxy -> implementation -> some contracts
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