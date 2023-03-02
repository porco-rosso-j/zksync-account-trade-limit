import { ethers, BigNumber } from 'ethers';
import { Provider, utils, Contract, Web3Provider, types, Signer } from 'zksync-web3';
import { UniswapV2Router, SwapModuleUniV2 } from "../../../typechain-types"
import {default as routerArtifact} from "artifacts/src/swap/UniswapV2Router.sol/UniswapV2Router.json"
import {default as swapModuleArtifact} from "artifacts/src/aa-wallet/modules/swapModule/SwapModuleUnV2.sol/SwapModuleUniV2.json"
import {address} from "./address"

const gasLimit = ethers.utils.hexlify(1000000)
const provider = new Provider("http://localhost:3050", 270);
const web3provider = new Web3Provider(window.ethereum)
const signer: Signer = (new Web3Provider(window.ethereum)).getSigner();
const router = <UniswapV2Router>(new Contract(address.router, routerArtifact.abi, signer))

export async function _quoteSwap(tokenIn:string | undefined, tokenOut:string | undefined, quantity: BigInt):Promise<BigNumber> {

    tokenIn = tokenIn == "native" ? address.weth : tokenIn
    tokenOut = tokenOut == "native" ? address.weth : tokenOut

    const path = (tokenIn != address.weth && tokenOut != address.weth)
       ? [tokenIn as string, address.weth, tokenOut as string] 
       : [tokenIn as string, tokenOut as string]

    const quote = await router.callStatic.getAmountsOut(BigNumber.from(quantity), path)

    return quote[quote.length -1]
}

const swapModule = <SwapModuleUniV2>(new Contract(address.swapModule, swapModuleArtifact.abi, signer))

async function getPaymasterParam(path:string[], GeneralFlow:boolean):Promise<types.Eip712Meta> {

    console.log("a")
    const abiCoder = new ethers.utils.AbiCoder();
    const input = abiCoder.encode(["address"], [address.sponsor1])

    console.log("b")
    let params: types.PaymasterParams;
    if (GeneralFlow) {
        params = utils.getPaymasterParams(address.gaspond, {
            type: "General",
            innerInput: input
        } as types.GeneralPaymasterInput 
        );
    } else {

        const eth_fee = BigNumber.from(1000000 * Number((await provider.getGasPrice())))
        const output = path[0] == address.weth
         ? await router.callStatic.getAmountsIn(eth_fee, path) : [eth_fee, BigNumber.from(0)];

        const token_fee = BigNumber.from(Number(output[0]) * 1.5)

        console.log("eth_fee: ", eth_fee)
        console.log("token_fee: ", token_fee)
        
        params = utils.getPaymasterParams(address.gaspond, {
            type: "ApprovalBased",
            token: path[0],
            minimalAllowance: token_fee,
            innerInput: input,
        }as types.ApprovalBasedPaymasterInput 
        );
    }

    console.log("params: ", params)
    const _customeData = {
        gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
        paymasterParams: params
    } as types.Eip712Meta

    return _customeData

}

async function getEIP712TxRequest(to:string, popTx:any, _customeData:types.Eip712Meta):Promise<types.TransactionRequest> {
    return {
        from: to as string,
        to: swapModule.address,
        chainId: (await provider.getNetwork()).chainId,
        maxFeePerGas: await provider.getGasPrice(),
        nonce: await provider.getTransactionCount(to as string),
        maxPriorityFeePerGas: BigNumber.from(0),
        type: 113,
        data: popTx.data as string,
        customData: _customeData,
        value: BigNumber.from(0),
        gasPrice: await provider.getGasPrice(),
        gasLimit: BigNumber.from(1500000) 
    }
}

export async function _swapETHForTokenAA(
    tokenOut:string | undefined, 
    quantity: BigInt, 
    to:string | undefined,
    GeneralFlow: boolean
    ):Promise<any> {

    const path = [address.weth, tokenOut as string]    
    const popTx = await swapModule.populateTransaction.swapETHForToken(
        BigNumber.from(quantity),
        path
    )

    const customData = await getPaymasterParam(path, GeneralFlow)
    let tx: types.TransactionRequest = await getEIP712TxRequest(to as string, popTx, customData)

    const signature = ethers.utils.arrayify(ethers.utils.joinSignature(await signer.eip712.sign(tx)))

    tx.customData = {
        ...tx.customData,
        customSignature: signature,
    };

   return await web3provider.sendTransaction(utils.serialize(tx))
}

export async function _swapTokenForETHAA(
    tokenIn:string | undefined, 
    quantity: BigInt, 
    to:string | undefined,
    GeneralFlow: boolean
    ):Promise<any> {
    console.log("1")
    const path = [tokenIn as string, address.weth]   
    console.log("2")
    console.log("tokenIn: ", tokenIn)
    console.log("quantity: ", quantity)
    const popTx = await swapModule.populateTransaction.swapTokenForETH(
        BigNumber.from(quantity),
        path
    )
    console.log("3")

    const customData = await getPaymasterParam(path, GeneralFlow)
    console.log("4")
    let tx: types.TransactionRequest = await getEIP712TxRequest(to as string, popTx, customData)

    console.log("5")
    const signature = ethers.utils.arrayify(ethers.utils.joinSignature(await signer.eip712.sign(tx)))

    tx.customData = {
        ...tx.customData,
        customSignature: signature,
    };
    
    console.log("6")
   return await web3provider.sendTransaction(utils.serialize(tx))
}

export async function _swapTokenForTokenAA(
    tokenIn:string | undefined, 
    tokenOut:string | undefined, 
    quantity: BigInt, 
    to:string | undefined,
    GeneralFlow: boolean
    ):Promise<any> {

    const path = [tokenIn as string, address.weth, tokenOut as string]  
    const popTx = await swapModule.populateTransaction.swapTokenForToken(
        BigNumber.from(quantity),
        path
    )

    const customData = await getPaymasterParam(path, GeneralFlow)
    let tx: types.TransactionRequest = await getEIP712TxRequest(to as string, popTx, customData)

    const signature = ethers.utils.arrayify(ethers.utils.joinSignature(await signer.eip712.sign(tx)))

    tx.customData = {
        ...tx.customData,
        customSignature: signature,
    };

   return await web3provider.sendTransaction(utils.serialize(tx))
}
