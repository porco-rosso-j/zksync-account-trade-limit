import { ethers, BigNumber, Contract } from 'ethers';
import { Provider, utils, Web3Provider } from 'zksync-web3';
import { NongaswapGPV2 } from "../../../typechain-types"
import {default as gasPondArtifact} from "artifacts/src/paymaster/NongaswapGPV2.sol/NongaswapGPV2.json" //yarn upgrade artifacts --latest
import {address} from "./address"
import { QueryParams, Falsy, useCall } from '@usedapp/core'


//let gaspond: NongaswapGPV2

const provider = Provider.getDefaultProvider();
const signer = (new Web3Provider(window.ethereum)).getSigner();
// gaspond = <NongaswapGPV2>(new Contract(address.gaspond, gasPondArtifact.abi, signer))

export function _isAssetSponsored(
    _token: string | Falsy,
    _sponsor: string | Falsy,
    _address: string | Falsy
): boolean | undefined {
    console.log("_sponsor: ", _sponsor)
    const {value, error} = 
        useCall(_token && _sponsor && {
            contract: new Contract(address.gaspond, gasPondArtifact.abi),
            method: 'isSponsoredAsset',
            args: [_token, _sponsor]
        }) ?? {}
   if(error) {
     console.error(error.message)
     return undefined
   }

   console.log("value: ", value?.[0])
    return value?.[0]
}


export function _isSponsoredPath(
    _tokenIn: string | Falsy,
    _tokenOut: string | Falsy,
    _sponsor: string | Falsy,
    _address: string | Falsy
): boolean | undefined {
    console.log("_tokenIn: ", _tokenIn)
    console.log("_tokenOut: ", _tokenOut)
    const path = _tokenIn && _tokenOut ? [_tokenIn, _tokenOut] : undefined;
    const {value, error} = 
        useCall(path && _sponsor && {
            contract: new Contract(address.gaspond, gasPondArtifact.abi),
            method: 'isSponsoredPath',
            args: [path, _sponsor]
        }) ?? {}
   if(error) {
     console.error(error.message)
     return undefined
   }

   console.log("value: ", value?.[0])
    return value?.[0]
}