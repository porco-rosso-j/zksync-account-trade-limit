import { Contract, BigNumber } from 'ethers';
import {default as swapModuleBaseArtifact} from "artifacts/src/aa-wallet/modules/swapModule/SwapModuleBase.sol/SwapModuleBase.json"
import {default as oracleArtifact} from "artifacts/src/aa-wallet/modules/swapModule/Oracle.sol/Oracle.json"
import {address} from "./address"
import { Falsy, useCall } from '@usedapp/core'

export function _checkTradeLimit(
    _address: string | Falsy,
    _tokenIn: string | Falsy,
    _amount: BigNumber | Falsy
): [boolean | undefined, number | undefined, number | undefined] | undefined {
    
    const {value, error} = 
        useCall(_address && _tokenIn && _amount && {
            contract: new Contract(address.swapModuleBase, swapModuleBaseArtifact.abi),
            method: 'checkTradeLimit',
            args: [_address, _tokenIn, _amount]
        }) ?? {}
   if(error) {
     console.error(error.message)
     return undefined
   }

   console.log("bool:", value?.[0])
   console.log("available raw:", value?.[1].toString())
   console.log("resetTime:", value?.[2])

    return [value?.[0], value?.[1], value?.[2]]
}

export function _dailyTradeLimit(): number | undefined {
    
    const {value, error} = 
        useCall({
            contract: new Contract(address.swapModuleBase, swapModuleBaseArtifact.abi),
            method: 'dailyTradeLimit',
            args: []
        }) ?? {}
   if(error) {
     console.error(error.message)
     return undefined
   }

    return value?.[0]

}

export function _isDailyTradeLimitEnabled(): boolean | undefined {
    
    const {value, error} = 
        useCall({
            contract: new Contract(address.swapModuleBase, swapModuleBaseArtifact.abi),
            method: 'isDailyTradeLimitEnabled',
            args: []
        }) ?? {}
   if(error) {
     console.error(error.message)
     return undefined
   }

    return value?.[0]

}

export function _maxTradeAmountUSD(): number | undefined {
    
    const {value, error} = 
        useCall({
            contract: new Contract(address.swapModuleBase, swapModuleBaseArtifact.abi),
            method: 'maxTradeAmountUSD',
            args: []
        }) ?? {}
   if(error) {
     console.error(error.message)
     return undefined
   }

    return value?.[0]

}

export function _getPrice(_token:string | undefined): number | undefined {

    const {value, error} = 
        useCall(_token && {
            contract: new Contract(address.oracle, oracleArtifact.abi),
            method: 'getAssetPrice',
            args: [_token]
        }) ?? {}
   if(error) {
     console.error(error.message)
     return undefined
   }

   const price = Number(value?.[0]) / 1e18;

    return price

}
