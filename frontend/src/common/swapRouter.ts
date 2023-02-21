import { ethers, BigNumber } from 'ethers';
import { Wallet, Provider } from 'zksync-web3';
import { UniswapV2Router } from "../../../typechain-types"
import {default as routerArtifact} from "artifacts/src/swap/UniswapV2Router.sol/UniswapV2Router.json"
import {address} from "./address"

let router: UniswapV2Router

export async function _quoteSwap(tokenIn:string | undefined, tokenOut:string | undefined, quantity: BigInt):Promise<BigNumber> {
    if (tokenIn == "native" ) {
        tokenIn = address.weth
    } else if (tokenOut == "native" ){
        tokenOut = address.weth
    }
    const provider = Provider.getDefaultProvider();
    router = <UniswapV2Router>(new ethers.Contract(address.router, routerArtifact.abi, provider))
    const path = [tokenIn as string, tokenOut as string]
    const quote = await router.callStatic.getAmountsOut(BigNumber.from(quantity), path)
    return quote[1]
}

export async function _swapETH(tokenOut:string | undefined, quantity: BigInt, to:string | undefined):Promise<any> {
    const provider = Provider.getDefaultProvider();

    router = <UniswapV2Router>(new ethers.Contract(address.router, routerArtifact.abi, provider))
    const path = [address.weth, tokenOut as string]

    const quote = await router.callStatic.getAmountsOut(BigNumber.from(quantity), path)

    const tx = await router.populateTransaction.swapExactETHForTokens(
        quote[1], 
        path,
        to as string, 
        ethers.constants.MaxUint256, 
        {value:BigNumber.from(quantity)}
        )

    return tx;
}

export async function _swapToken(tokenIn: string | undefined, quantity: BigInt, to:string | undefined):Promise<any> {
    const provider = Provider.getDefaultProvider();

    router = <UniswapV2Router>(new ethers.Contract(address.router, routerArtifact.abi, provider))
    const path = [tokenIn as string, address.weth]

    const quote = await router.callStatic.getAmountsOut(BigNumber.from(quantity), path)
    console.log("quote:", quote)

    const tx = await router.populateTransaction.swapExactTokensForETH(
        BigNumber.from(quantity),
        quote[1], 
        path,
        to as string, 
        ethers.constants.MaxUint256
        )

    return tx;
}