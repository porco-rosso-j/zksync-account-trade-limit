//https://book.getfoundry.sh/config/hardhat

import fs from "fs";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-solc";
import "hardhat-preprocessor";
import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";
dotenv.config();

function getRemappings() {
  return fs
    .readFileSync("remappings.txt", "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => line.trim().split("="));
}

const zkSyncTestnet =
  process.env.NODE_ENV == "test"
    ? {
        url: "http://localhost:3050",
        ethNetwork: "http://localhost:8545",
        zksync: true,
      }
    : {
        url: "https://zksync2-testnet.zksync.dev",
        ethNetwork: "https://eth-mainnet.g.alchemy.com/v2/" + process.env.ALCHEMY_API_KEY_GOERLI, // e.g. alchemy url
        zksync: true,
        verifyURL: 'https://zksync2-testnet-explorer.zksync.dev/contract_verification'
      };

const compilers = [
    {version: "0.4.0"}, {version: "0.5.16"}, {version: "0.6.0"}, {version: "0.6.6"},
    {version: "0.6.12"}, {version: "0.8.0"}, {version: "0.8.1"}, {version: "0.8.11"},
]

interface HHzkSyncFoundryConfig extends HardhatUserConfig {
    zksolc:any,
    preprocess:any,
}

const config: HHzkSyncFoundryConfig = {
  zksolc: {
        version: '1.2.1',
        compilerSource: 'binary',
        settings: {},
      },
  solidity: {
    compilers: compilers
  },
  defaultNetwork: "zkSyncTestnet",

  networks: {
    hardhat: {
        // @ts-ignore
        zksync: true
    },
    zkSyncTestnet,
  },
  //This fully resolves paths for imports in the ./lib directory for Hardhat
  preprocess: {
    eachLine: (hre) => ({
      transform: (line: string) => {
        if (line.match(/^\s*import /i)) {
          for (const [from, to] of getRemappings()) {
            if (line.includes(from)) {
              line = line.replace(from, to);
              break;
            }
          }
        }
        return line;
      },
    }),
  },

  paths: {
    sources: "./src", // Use ./src rather than ./contracts as Hardhat expects
    cache: "./cache", // Use a different cache for Hardhat than Foundry
  },
};

export default config;