
import { Chain } from "@usedapp/core"
import { getAddressLink, getTransactionLink } from "@usedapp/core/src/helpers/chainExplorerLink"

const zksyncExplorerUrl = 'https://zksync2-testnet.zkscan.io'

export const ZkSyncLocal:Chain = {
    chainId: 270,
    chainName: 'zkSync local',
    isTestChain: true,
    isLocalChain: true,
    multicallAddress: '0x7fB5f3D1f6288ea954CaA1136B6068b7D1D8Dc57',
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