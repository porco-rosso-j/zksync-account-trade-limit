import { expect } from "chai";
import "@matterlabs/hardhat-zksync-chai-matchers";
import { ethers, constants as ethconst  } from "ethers";
import { rich_wallet } from "./utils/rich-wallet"
import { deployUniswapFactory, getPairByteCode, getPairContract, getFactoryContract } from "./utils/deploy"
import { Wallet, Provider, utils } from "zksync-web3";
import { UniswapV2Factory } from "../../typechain-types";

const TEST_ADDRESSES: [string, string] = [
  "0x1000000000000000000000000000000000000000",
  "0x2000000000000000000000000000000000000000",
];

describe("UniswapV2Factory", () => {
  async function deploy() {
    const provider = new Provider("http://localhost:3050", 270);;
    const wallet = new Wallet(rich_wallet[0].privateKey, provider);
    const other =new Wallet(rich_wallet[1].privateKey, provider);
    const factory = <UniswapV2Factory>(await deployUniswapFactory(wallet));
    return { factory: factory, wallet, other };
  }

  it("feeTo, feeToSetter, allPairsLength", async () => {
    const { factory, wallet } = await deploy();
    expect(await factory.feeTo()).to.eq(ethconst.AddressZero);
    expect(await factory.feeToSetter()).to.eq(wallet.address);
    expect(await factory.allPairsLength()).to.eq(0);
  });

  async function createPair(wallet: Wallet, factory: UniswapV2Factory, tokens: [string, string]) {
    const pairBytecode = await getPairByteCode(wallet);
    const create2Address = utils.create2Address(
      factory.address,
      utils.hashBytecode(pairBytecode), // bytecodeHash
      ethers.utils.keccak256(ethers.utils.solidityPack(['address', 'address'], [TEST_ADDRESSES[0], TEST_ADDRESSES[1]])), // salt
      []
    );
    
    await expect(factory.createPair(tokens[0], tokens[1], {gasLimit: ethers.BigNumber.from(1000000)}))
      .to.emit(factory, "PairCreated")
      .withArgs(TEST_ADDRESSES[0], TEST_ADDRESSES[1], create2Address, 1)
    await expect(factory.createPair(tokens[0], tokens[1], {gasLimit: ethers.BigNumber.from(1000000)})).to.be.reverted; // UniswapV2: PAIR_EXISTS
    await expect(factory.createPair(tokens[1], tokens[0], {gasLimit: ethers.BigNumber.from(1000000)})).to.be.reverted; // UniswapV2: PAIR_EXISTS

    expect(await factory.getPair(tokens[0], tokens[1])).to.eq(create2Address);
    expect(await factory.getPair(tokens[1], tokens[0])).to.eq(create2Address);
    expect(await factory.allPairs(0)).to.eq(create2Address);
    expect(await factory.allPairsLength()).to.eq(1);

    const pair = await getPairContract(create2Address, wallet)
    expect(await pair.factory()).to.eq(factory.address);
    expect(await pair.token0()).to.eq(TEST_ADDRESSES[0]);
    expect(await pair.token1()).to.eq(TEST_ADDRESSES[1]);
  }

  it("Pair:codeHash", async () => {
    const { factory } = await deploy();
    const codehash = await factory.PAIR_HASH();
    expect(codehash).to.be.eq(
      "0x010003c50a9143a16c422a86a847acf86c7f90d24c40feb2f835e7eb03963ede"
    );
  });

  it("createPair", async () => {
    const { factory, wallet } = await deploy();
    await createPair(wallet, factory, [...TEST_ADDRESSES]);
  });

  it("createPair:reverse", async () => {
    const { factory, wallet } = await deploy();
    await createPair(
      wallet,
      factory,
      TEST_ADDRESSES.slice().reverse() as [string, string]
    );
  });

  it("createPair:gas", async () => {
    const { factory } = await deploy();
    const tx = await factory.createPair(...TEST_ADDRESSES);
    const receipt = await tx.wait();
    expect(receipt.gasUsed).to.eq(263194);
  });

  it("setFeeTo", async () => {
    const { factory, wallet, other } = await deploy();
    const factoryContract = await getFactoryContract(factory.address, other)
    await expect(
      factoryContract.setFeeTo(other.address)
    ).to.be.revertedWith("UniswapV2: FORBIDDEN");
    await(await factory.setFeeTo(wallet.address)).wait();
    expect(await factory.feeTo()).to.eq(wallet.address);
  });

  it("setFeeToSetter", async () => {
    const { factory, wallet, other } = await deploy();
    const factoryContract = await getFactoryContract(factory.address, other)
    await expect(
      factoryContract.setFeeToSetter(other.address)
    ).to.be.revertedWith("UniswapV2: FORBIDDEN");
    await(await factory.setFeeToSetter(other.address)).wait();
    expect(await factory.feeToSetter()).to.eq(other.address);
    await expect(factory.setFeeToSetter(wallet.address)).to.be.revertedWith(
      "UniswapV2: FORBIDDEN"
    );
  });
});
