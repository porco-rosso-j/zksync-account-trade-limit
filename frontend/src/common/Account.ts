import { Contract, ethers } from 'ethers';
import {default as accountArtifact} from "./artifacts/Account.json"
//import {address} from "./address"
import { Falsy, useCall } from '@usedapp/core'

export function _isAccountOwner(
    contractAcc: string | Falsy,
    account: string | Falsy
): boolean | undefined {
     console.log("contractAcc: ", contractAcc)
    const {value, error} = 
        useCall(contractAcc && account && {
            contract: new Contract(contractAcc as string, accountArtifact.abi),
            method: 'owner',
            args: []
        }) ?? {}
   if(error) {
     console.error(error.message)
     return undefined
   }

   console.log("value: ", value?.[0])
    return value?.[0] == account
}
