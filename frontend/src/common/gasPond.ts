import { Contract, ethers } from 'ethers';
import {default as gasPondArtifact} from "./artifacts/GasPond.json"
import {address} from "./address"
import { Falsy, useCall } from '@usedapp/core'

export function _isGasPayableERC20(
    _token: string | Falsy,
    _sponsor: string | Falsy,
    _address: string | Falsy
): boolean | undefined {
    const {value, error} = 
        useCall(_token && _sponsor && {
            contract: new Contract(address.gaspond, gasPondArtifact.abi),
            method: 'isGasPayableERC20',
            args: [_token, _sponsor]
        }) ?? {}
   if(error) {
     console.error(error.message)
     return undefined
   }

    return value?.[0]
}


export function _isGasPayablePath(
    _tokenIn: string | Falsy,
    _tokenOut: string | Falsy,
    _sponsor: string | Falsy,
    _address: string | Falsy
): boolean | undefined {

    const path = 
    !_tokenIn || !_tokenOut
    ? [ethers.constants.AddressZero, ethers.constants.AddressZero] :
    (_tokenIn != address.weth && _tokenOut != address.weth)
    ? [_tokenIn, address.weth, _tokenOut] : [_tokenIn, _tokenOut];

    const {value, error} = 
        useCall(path && _sponsor && {
            contract: new Contract(address.gaspond, gasPondArtifact.abi),
            method: 'isGasPayablePath',
            args: [path, _sponsor]
        }) ?? {}
   if(error) {
     console.error(error.message)
     return undefined
   }

    return value?.[0]

}