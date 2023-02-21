
import { Chain } from "@usedapp/core"
import {address} from "./address"

const zksyncExplorerUrl = 'https://zksync2-testnet.zkscan.io'

export const ZkSyncLocal:Chain = {
    chainId: 270,
    chainName: 'zkSync local',
    isTestChain: true,
    isLocalChain: true,
    multicallAddress: address.multicall,
    multicall2Address: '0x32Caf123F6f574035f51532E597125062C0Aa8EE',
    rpcUrl: 'http://localhost:3050',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18,
    },
    blockExplorerUrl: zksyncExplorerUrl,
    getExplorerAddressLink: () => '',
    getExplorerTransactionLink: () => '',
  }