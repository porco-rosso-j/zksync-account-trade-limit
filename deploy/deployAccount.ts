import { ethers} from "ethers";
import { Wallet, utils, Contract} from 'zksync-web3';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { toBN, GASLIMIT } from "./utils/helper";

// Deploy function
export async function deployAccount (
    wallet: Wallet,
    deployer: Deployer,
    daiContract:Contract,
    moduleManager:Contract,
    registry: Contract
    ) {

    // Deploy AccountFactory
    const factoryArtifact = await deployer.loadArtifact("AccountFactory");
    const accountArtifact = await deployer.loadArtifact("Account");
    const bytecodeHash = utils.hashBytecode(accountArtifact.bytecode);

    const factory = <Contract>(await deployer.deploy(
        factoryArtifact, 
        [bytecodeHash, moduleManager.address, registry.address], 
        undefined, 
        [accountArtifact.bytecode,])
        );

    console.log(`aafactory: "${factory.address}",`)

    // Deploy Account  && Setup
    const salt = ethers.constants.HashZero; 
    const transaction = await(await factory.deployAccount(salt, wallet.address, GASLIMIT)).wait();
    const accountAddr = (await utils.getDeployedContracts(transaction))[0].deployedAddress
    
    const accountContract = new ethers.Contract(accountAddr, accountArtifact.abi, wallet)
    console.log(`account: "${accountContract.address}",`)
    await(await accountContract.addModules([1], GASLIMIT)).wait();

    // mint 100k DAI to account
    await (await daiContract.mint(accountContract.address, toBN("100000"))).wait();
}

