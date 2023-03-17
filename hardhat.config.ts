//https://book.getfoundry.sh/config/hardhat

import fs from "fs";
import { HardhatUserConfig } from "hardhat/config";
import "@matterlabs/hardhat-zksync-chai-matchers";
import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-solc";
import "hardhat-preprocessor";
import "@typechain/hardhat";
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
  process.env.NODE_ENV == "local"
    ? {
        url: "http://localhost:3050",
        ethNetwork: "http://localhost:8545",
        zksync: true,
        timeout: 100000
      } : {
        url: "https://zksync2-testnet.zksync.dev",
        ethNetwork: "https://eth-mainnet.g.alchemy.com/v2/" + process.env.ALCHEMY_API_KEY_GOERLI, // e.g. alchemy url
        zksync: true,
        verifyURL: 'https://zksync2-testnet-explorer.zksync.dev/contract_verification'
      };

const compilers = [
   {version: "0.8.1"}, {version: "0.8.4"}, {version: "0.8.11"},
   
]

const config: HardhatUserConfig = {
//module.exports = {
  zksolc: {
        version: '1.3.5',
        compilerSource: 'binary',
        settings: {
          isSystem: true
        },
        
      },
      
  solidity: {
    compilers: compilers,

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
    //artifacts: "./frontend/artifacts"
  },
};

export default config;