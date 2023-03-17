import { ethers, BigNumber } from 'ethers';
import { Provider, utils, Contract, Web3Provider, types, Signer } from 'zksync-web3';
import { UniswapV2Router, SwapModuleUniV2, MockTKN } from "../../../typechain-types"
import {default as tokenArtifact} from "./artifacts/MockTKN.json"
import {default as routerArtifact} from "./artifacts/UniswapV2Router.json"
import {default as swapModuleArtifact} from "./artifacts/SwapModuleUniV2.json"
import {address} from "./address"

const provider = new Provider("http://localhost:3050", 270);
const web3provider = new Web3Provider(window.ethereum)
const signer: Signer = (new Web3Provider(window.ethereum)).getSigner();
const router = <UniswapV2Router>(new Contract(address.router, routerArtifact.abi, signer))
const swapModule = <SwapModuleUniV2>(new Contract(address.swapModule, swapModuleArtifact.abi, signer))

async function getPaymasterParam(path:string[], GeneralFlow:boolean):Promise<types.Eip712Meta> {

    const abiCoder = new ethers.utils.AbiCoder();
    const input = abiCoder.encode(["address"], [address.sponsor1])

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

        params = utils.getPaymasterParams(address.gaspond, {
            type: "ApprovalBased",
            token: path[0],
            minimalAllowance: token_fee,
            innerInput: input,
        }as types.ApprovalBasedPaymasterInput 
        );
    }

    const _customData = {
        gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
        paymasterParams: params
    } as types.Eip712Meta

    return _customData

}

async function getEIP712TxRequest(to:string, calldata:string | undefined, _customData:types.Eip712Meta):Promise<types.TransactionRequest> {
    return {
        from: address.account,
        to: to,
        chainId: (await provider.getNetwork()).chainId,
        maxFeePerGas: await provider.getGasPrice(),
        nonce: await provider.getTransactionCount(to as string),
        maxPriorityFeePerGas: BigNumber.from(0),
        type: 113,
        data: calldata as string,
        customData: _customData,
        value: BigNumber.from(0),
        gasPrice: await provider.getGasPrice(),
        gasLimit: BigNumber.from(1500000) 
    }
}

async function addSignature(tx:any):Promise<any> {
    const signature = ethers.utils.arrayify(ethers.utils.joinSignature(await signer.eip712.sign(tx)))

    tx.customData = {
        ...tx.customData,
        customSignature: signature,
    };
    return tx;
 } 

export async function _swapETHForTokenAA(
    tokenOut:string | undefined, 
    quantity: BigInt, 
    to:string | undefined,
    GeneralFlow: boolean
    ):Promise<any> {

    const path = [address.weth, tokenOut as string]    
    const swapTx = await swapModule.populateTransaction.swapETHForToken(
        BigNumber.from(quantity),
        path
    )

    const customData = await getPaymasterParam(path, GeneralFlow)
    let tx: types.TransactionRequest = await getEIP712TxRequest(address.swapModule, swapTx.data, customData)

    tx = await addSignature(tx)

    return await web3provider.sendTransaction(utils.serialize(tx))
}

export async function _swapTokenForETHAA(
    tokenIn:string | undefined, 
    quantity: BigInt, 
    to:string | undefined,
    GeneralFlow: boolean
    ):Promise<any> {

    const path = [tokenIn as string, address.weth]
    const swapTx = await swapModule.populateTransaction.swapTokenForETH(
        BigNumber.from(quantity),
        path
    )

    const hasApproval:boolean = await checkAllowance(tokenIn as string, router.address, BigNumber.from(quantity))
    console.log("hasApproval: ", hasApproval)
    const callData: string | undefined = hasApproval 
    ? swapTx.data 
    : await getSwapTxWithApproval(swapTx, tokenIn as string,  BigNumber.from(quantity))

    console.log("callData: ", callData)
    
    const customData = await getPaymasterParam(path, GeneralFlow)
    let tx: types.TransactionRequest = await getEIP712TxRequest(hasApproval ? address.swapModule : to as string, callData, customData)

    tx = await addSignature(tx)
    
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
    const swapTx = await swapModule.populateTransaction.swapTokenForToken(
        BigNumber.from(quantity),
        path
    )

    const hasApproval:boolean = await checkAllowance(tokenIn as string, router.address, BigNumber.from(quantity))
    const callData: string | undefined = hasApproval 
    ? swapTx.data 
    : await getSwapTxWithApproval(swapTx, tokenIn as string,  BigNumber.from(quantity))
    
    const customData = await getPaymasterParam(path, GeneralFlow)
    let tx: types.TransactionRequest = await getEIP712TxRequest(hasApproval ? address.swapModule : to as string, callData, customData)

    tx = await addSignature(tx)

    return await web3provider.sendTransaction(utils.serialize(tx))
}


const BATCH_SELECTOR = "0x29451959"

async function constructBatchedCalldata(transactions: ethers.PopulatedTransaction[]):Promise<any> {

    const isDelegatecalls:boolean[] = [];
    const targets:string[] = [];
    const methods:string[] = [];
    const values:BigNumber[] = [];

    for (let i = 0; i < transactions.length; i++) {

        const isDelegatecall:boolean = transactions[i].to as string == address.swapModule ? true : false;
        isDelegatecalls.push(isDelegatecall);

        targets.push(transactions[i].to as string)
        methods.push(transactions[i].data as string)

        const value:BigNumber = transactions[i].value ? transactions[i].value as BigNumber : BigNumber.from(0);
        values.push(value)
    }

    // Encode contract addresses and methods data for Multicall
    const AbiCoder = new ethers.utils.AbiCoder()
    const batchedCalldata: string 
    = AbiCoder.encode(
        ["bool[]", "address[]", "bytes[]", "uint[]"], 
        [isDelegatecalls, targets, methods, values]
        )
    console.log("batchedCalldata: ", batchedCalldata)
    return BATCH_SELECTOR.concat(batchedCalldata.replace("0x", ""))

}

async function getSwapTxWithApproval(swapTx: any, token:string, amount:BigNumber):Promise<string> {
    const tokenContract = <MockTKN>(new Contract(token, tokenArtifact.abi, signer))
    const approveTx = await tokenContract.populateTransaction.approve(router.address, amount)
    return await constructBatchedCalldata([approveTx, swapTx])
}

async function checkAllowance(token:string, router:string, amount:BigNumber):Promise<any> {
    const tokenContract = <MockTKN>(new Contract(token, tokenArtifact.abi, signer))
    const allowance:BigNumber = await tokenContract.allowance(address.account, router)
    console.log("allowance: ", allowance.toString())
    return allowance > amount
}