import { ethers, BigNumber } from 'ethers';
import { Provider, utils, Contract, Web3Provider } from 'zksync-web3';
import { UniswapV2Router } from "../../../typechain-types"
import {default as routerArtifact} from "artifacts/src/swap/UniswapV2Router.sol/UniswapV2Router.json"
import {address} from "./address"

let router: UniswapV2Router

const provider = Provider.getDefaultProvider();
const signer = (new Web3Provider(window.ethereum)).getSigner();
router = <UniswapV2Router>(new Contract(address.router, routerArtifact.abi, signer))

export async function _quoteSwap(tokenIn:string | undefined, tokenOut:string | undefined, quantity: BigInt):Promise<BigNumber> {

    tokenIn = tokenIn == "native" ? address.weth : tokenIn
    tokenOut = tokenOut == "native" ? address.weth : tokenOut

    let path = [tokenIn as string, tokenOut as string]

    if ( tokenIn != address.weth && tokenOut != address.weth) {
        path = [tokenIn as string, address.weth, tokenOut as string]
        const quote = await router.callStatic.getAmountsOut(BigNumber.from(quantity), path)
        return quote[2]
    }

    const quote = await router.callStatic.getAmountsOut(BigNumber.from(quantity), path)

    return quote[1]
}

export async function _swapETHForToken(tokenOut:string | undefined, quantity: BigInt, to:string | undefined):Promise<any> {
    const path = [address.weth, tokenOut as string]

    const quote = await router.callStatic.getAmountsOut(BigNumber.from(quantity), path)

    const tx = await router.swapExactETHForTokens(
        quote[1], 
        path,
        to as string, 
        ethers.constants.MaxUint256, 
        {value:BigNumber.from(quantity)}
    )

    return tx;
}

export async function _swapTokenForETH(tokenIn: string | undefined, quantity: BigInt, to:string | undefined):Promise<any> {

    const path = [tokenIn as string, address.weth]

    const quote = await router.callStatic.getAmountsOut(BigNumber.from(quantity), path)

    const tx = await router.swapExactTokensForETH(
        BigNumber.from(quantity),
        quote[1], 
        path,
        to as string, 
        ethers.constants.MaxUint256
        )

    return tx;
}

export async function _swapTokenForToken(tokenIn: string | undefined, tokenOut: string | undefined, quantity: BigInt, to:string | undefined):Promise<any> {

    const path = [tokenIn as string, address.weth, tokenOut as string]

    const quote = await router.callStatic.getAmountsOut(BigNumber.from(quantity), path)

    const tx = await router.swapExactTokensForTokens(
        BigNumber.from(quantity),
        quote[2], 
        path,
        to as string, 
        ethers.constants.MaxUint256
        )

    return tx;
}

//// Sponsored Swaps /////

const abiCoder = new ethers.utils.AbiCoder();
const input = abiCoder.encode(["address", "address"], [address.sponsor1, "0x0000000000000000000000000000000000000000"])

const params = utils.getPaymasterParams(address.gaspond, {
    type: "General",
    innerInput: input
});

const customData = {
    gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT, // or gasPerPubdata?
    paymasterParams: params
}

export async function _swapETHForTokenSponsored(
    tokenOut:string | undefined, 
    quantity: BigInt, 
    to:string | undefined):Promise<any> {

    const path = [address.weth, tokenOut as string]
    const quote = await router.callStatic.getAmountsOut(BigNumber.from(quantity), path)

    const gasLimit = await router.estimateGas.swapExactETHForTokens(
        quote[1], 
        path,
        to as string, 
        ethers.constants.MaxUint256,
        {
            value:BigNumber.from(quantity),
            customData: customData
        }
      );

    const tx = await router.swapExactETHForTokens(
        quote[1], 
        path,
        to as string, 
        ethers.constants.MaxUint256, 
        {
            value:BigNumber.from(quantity),
            maxFeePerGas: await provider.getGasPrice(),
            maxPriorityFeePerGas: ethers.BigNumber.from(0),
            customData: customData,
            gasLimit:gasLimit
        }
    )

    return tx;
}

export async function _swapTokenForETHSponsored(
    tokenIn:string | undefined, 
    quantity: BigInt, 
    to:string | undefined):Promise<any> {

    const path = [tokenIn as string, address.weth]
    const quote = await router.callStatic.getAmountsOut(BigNumber.from(quantity), path)

    const gasLimit = await router.estimateGas.swapExactTokensForETH(
        BigNumber.from(quantity),
        quote[1], 
        path,
        to as string, 
        ethers.constants.MaxUint256,
        {customData: customData}
      );

    let tx = await router.swapExactTokensForETH(
        BigNumber.from(quantity),
        BigNumber.from(0), 
        path,
        to as string, 
        ethers.constants.MaxUint256,
        {
            maxFeePerGas: await provider.getGasPrice(),
            maxPriorityFeePerGas: ethers.BigNumber.from(0),
            customData: customData,
            gasLimit:gasLimit
        }
    )

    return tx;
}


export async function _swapTokenForTokenSponsored(
    tokenIn:string | undefined, 
    tokenOut:string | undefined, 
    quantity: BigInt, 
    to:string | undefined):Promise<any> {

    const path = [tokenIn as string, address.weth, tokenOut as string]
    const quote = await router.callStatic.getAmountsOut(BigNumber.from(quantity), path)

    const gasLimit = await router.estimateGas.swapExactTokensForTokens(
        BigNumber.from(quantity),
        quote[2], 
        path,
        to as string, 
        ethers.constants.MaxUint256,
        {customData: customData}
      );

    let tx = await router.swapExactTokensForTokens(
        BigNumber.from(quantity),
        quote[2],
        path,
        to as string, 
        ethers.constants.MaxUint256,
        {
            maxFeePerGas: await provider.getGasPrice(),
            maxPriorityFeePerGas: ethers.BigNumber.from(0),
            customData: customData,
            gasLimit:gasLimit
        }
    )
    
    return tx;
}