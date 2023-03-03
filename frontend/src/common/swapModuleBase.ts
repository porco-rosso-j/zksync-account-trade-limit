import { Contract, BigNumber } from 'ethers';
import {default as swapModuleBaseArtifact} from "artifacts/src/aa-wallet/modules/swapModule/SwapModuleBase.sol/SwapModuleBase.json"
import {address} from "./address"
import { Falsy, useCall } from '@usedapp/core'

export function _checkTradeLimit(
    _address: string | Falsy,
    _tokenIn: string | Falsy,
    _amount: BigNumber | Falsy
): [boolean | undefined, number | undefined] | undefined {
    
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
   console.log("available:", value?.[1].toString())

    return [value?.[0], value?.[1]]
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
