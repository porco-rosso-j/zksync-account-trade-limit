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
    if (tokenIn == "native" ) {
        tokenIn = address.weth
    } else if (tokenOut == "native" ){
        tokenOut = address.weth
    }
    const path = [tokenIn as string, tokenOut as string]
    const quote = await router.callStatic.getAmountsOut(BigNumber.from(quantity), path)
    return quote[1]
}

export async function _swapETH(tokenOut:string | undefined, quantity: BigInt, to:string | undefined):Promise<any> {
    const path = [address.weth, tokenOut as string]

    const quote = await router.callStatic.getAmountsOut(BigNumber.from(quantity), path)

    // const tx = await router.populateTransaction.swapExactETHForTokens(
    const tx = await router.swapExactETHForTokens(
        quote[1], 
        path,
        to as string, 
        ethers.constants.MaxUint256, 
        {value:BigNumber.from(quantity)}
    )

    return tx;
}

export async function _swapToken(tokenIn: string | undefined, quantity: BigInt, to:string | undefined):Promise<any> {

    const path = [tokenIn as string, address.weth]

    const quote = await router.callStatic.getAmountsOut(BigNumber.from(quantity), path)
    console.log("quote:", quote)

    //const tx = await router.populateTransaction.swapExactTokensForETH(
    const tx = await router.swapExactTokensForETH(
        BigNumber.from(quantity),
        quote[1], 
        path,
        to as string, 
        ethers.constants.MaxUint256
        )

    //tx.gasLimit = await provider.estimateGas(tx)

    return tx;
}

export async function _swapETHSponsored(
    signer: any, 
    tokenOut:string | undefined, 
    quantity: BigInt, 
    to:string | undefined):Promise<any> {

   const routerContract = <UniswapV2Router>(new Contract(address.router, routerArtifact.abi, signer))

    const path = [address.weth, tokenOut as string]
    const quote = await routerContract.callStatic.getAmountsOut(BigNumber.from(quantity), path)

    const abiCoder = new ethers.utils.AbiCoder();
    const input = abiCoder.encode(
        ["address", "address"],
        ["0x36615Cf349d7F6344891B1e7CA7C72883F5dc049", 
         "0x36615Cf349d7F6344891B1e7CA7C72883F5dc049"]
        )

    const params = utils.getPaymasterParams(address.gaspond, {
        type: "General",
        innerInput: input
    });

    const customData = {
        gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT, // or gasPerPubdata?
        paymasterParams: params
    }

    const gasLimit = await routerContract.estimateGas.swapExactETHForTokens(
        quote[1], 
        path,
        to as string, 
        ethers.constants.MaxUint256,
        {
            value:BigNumber.from(quantity),
            customData: customData
        }
      );

    const tx = await routerContract.swapExactETHForTokens(
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

export async function _swapTokenSponsored(
    signer: any, 
    tokenIn:string | undefined, 
    quantity: BigInt, 
    to:string | undefined):Promise<any> {

   console.log("stop: ", 0)
   console.log("quantity: ", quantity)

   const routerContract = <UniswapV2Router>(new Contract(address.router, routerArtifact.abi, signer))

    const path = [tokenIn as string, address.weth]
    const quote = await routerContract.callStatic.getAmountsOut(BigNumber.from(quantity), path)

    console.log("stop: ", 1)

    const abiCoder = new ethers.utils.AbiCoder();
    const input = abiCoder.encode(
        ["address", "address"],
        ["0x36615Cf349d7F6344891B1e7CA7C72883F5dc049", 
         "0x36615Cf349d7F6344891B1e7CA7C72883F5dc049"]
        )

    console.log("stop: ", 2)

    const params = utils.getPaymasterParams(address.gaspond, {
        type: "General",
        innerInput: input
    });

    const customData = {
        gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT, // or gasPerPubdata?
        paymasterParams: params
    }

    console.log("BigNumber.from(quantity): ", BigNumber.from(quantity))
    console.log("quote[1]: ", quote[1])

    const gasLimit = await routerContract.estimateGas.swapExactTokensForETH(
        BigNumber.from(quantity),
        quote[1], 
        path,
        to as string, 
        ethers.constants.MaxUint256,
        {customData: customData}
      );

    console.log("stop: ", 3)

    let tx = await routerContract.swapExactTokensForETH(
        BigNumber.from(quantity),
        BigNumber.from(0), 
        path,
        to as string, 
        ethers.constants.MaxUint256,
        {
            from: signer.address,
            maxFeePerGas: await provider.getGasPrice(),
            maxPriorityFeePerGas: ethers.BigNumber.from(0),
            customData: customData,
            gasLimit:gasLimit
        }
    )

    console.log("stop: ", tx)
    //tx.gasLimit = await provider.estimateGas(tx)
    console.log("stop: ", 4)

    // const result = await provider.sendTransaction(utils.serialize(tx));

    return tx;
}