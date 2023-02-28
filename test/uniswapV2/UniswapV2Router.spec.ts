import { expect } from "chai";
import { ethers, BigNumber, constants as ethconst, getDefaultProvider } from "ethers";
import { rich_wallet } from "./utils/rich-wallet"
import "@matterlabs/hardhat-zksync-chai-matchers";
import { 
  deployUniswapFactory,
  deployERC20, 
  deployWETH,
  getPairContract, 
  deployRouterEmiter,
  deployRouterWithWETH
 } from "./utils/deploy"
import { Wallet, Provider } from "zksync-web3";
import { UniswapV2Factory, UniswapV2Pair, UniswapV2Router, ERC20Mock, RouterEventEmitter } from "../../typechain-types";
import { expandTo18Decimals, MINIMUM_LIQUIDITY, UniswapVersion } from "./utils/utilities";

const TOTAL_SUPPLY = expandTo18Decimals(100000);
const GAS_LIMIT = {gasLimit: BigNumber.from(1000000)}

describe("UniswapV2Router", () => {
  async function deploy() {
    const provider = new Provider("http://localhost:3050", 270);;
    const wallet = new Wallet(rich_wallet[0].privateKey, provider);

    // deploy tokens
    const tokenA = <ERC20Mock>(await deployERC20(wallet, TOTAL_SUPPLY));
    const tokenB = <ERC20Mock>(await deployERC20(wallet, TOTAL_SUPPLY));

    // deplpoy weth and its partner token
    const WETH = await deployWETH(wallet);
    const WETHPartner = <ERC20Mock>(await deployERC20(wallet, TOTAL_SUPPLY));

    // deploy V2
    const factoryV2 = <UniswapV2Factory>(await deployUniswapFactory(wallet))
    const RouterEmit = <RouterEventEmitter>(await deployRouterEmiter(wallet));

    // deploy routers
    const router02 = <UniswapV2Router>(await deployRouterWithWETH(wallet, factoryV2, WETH));

    // initialize V2
    await(await factoryV2.createPair(tokenA.address, tokenB.address)).wait();
    const pairAddress = await factoryV2.getPair(tokenA.address, tokenB.address);
    const pair = <UniswapV2Pair>(await getPairContract(pairAddress, wallet));

    const token0Address = await pair.token0();
    const token0 = tokenA.address === token0Address ? tokenA : tokenB;
    const token1 = tokenA.address === token0Address ? tokenB : tokenA;

    await(await factoryV2.createPair(WETH.address, WETHPartner.address)).wait();
    const WETHPairAddress = await factoryV2.getPair(
      WETH.address,
      WETHPartner.address
    );

    const wethPair = <UniswapV2Pair>(await getPairContract(WETHPairAddress, wallet));

    return {
      token0,
      token1,
      WETH,
      WETHPartner,
      factoryV2,
      router02,
      pair,
      RouterEmit,
      wallet,
      wethPair,
    };
  }

  it.skip("quote", async () => {
    const { router02: router } = await deploy();
    expect(
      await router.quote(
        BigNumber.from(1),
        BigNumber.from(100),
        BigNumber.from(200)
      )
    ).to.eq(BigNumber.from(2));
    expect(
      await router.quote(
        BigNumber.from(2),
        BigNumber.from(200),
        BigNumber.from(100)
      )
    ).to.eq(BigNumber.from(1));
    await expect(
      router.quote(BigNumber.from(0), BigNumber.from(100), BigNumber.from(200))
    ).to.be.revertedWith("UniswapV2Library: INSUFFICIENT_AMOUNT");
    await expect(
      router.quote(BigNumber.from(1), BigNumber.from(0), BigNumber.from(200))
    ).to.be.revertedWith("UniswapV2Library: INSUFFICIENT_LIQUIDITY");
    await expect(
      router.quote(BigNumber.from(1), BigNumber.from(100), BigNumber.from(0))
    ).to.be.revertedWith("UniswapV2Library: INSUFFICIENT_LIQUIDITY");
  });

  it.skip("getAmountOut", async () => {
    const { router02: router } = await deploy();

    expect(
      await router.getAmountOut(
        BigNumber.from(2),
        BigNumber.from(100),
        BigNumber.from(100)
      )
    ).to.eq(BigNumber.from(1));
    await expect(
      router.getAmountOut(
        BigNumber.from(0),
        BigNumber.from(100),
        BigNumber.from(100)
      )
    ).to.be.revertedWith("UniswapV2Library: INSUFFICIENT_INPUT_AMOUNT");
    await expect(
      router.getAmountOut(
        BigNumber.from(2),
        BigNumber.from(0),
        BigNumber.from(100)
      )
    ).to.be.revertedWith("UniswapV2Library: INSUFFICIENT_LIQUIDITY");
    await expect(
      router.getAmountOut(
        BigNumber.from(2),
        BigNumber.from(100),
        BigNumber.from(0)
      )
    ).to.be.revertedWith("UniswapV2Library: INSUFFICIENT_LIQUIDITY");
  });

  it.skip("getAmountIn", async () => {
    const { router02: router } = await deploy();

    expect(
      await router.getAmountIn(
        BigNumber.from(1),
        BigNumber.from(100),
        BigNumber.from(100)
      )
    ).to.eq(BigNumber.from(2));
    await expect(
      router.getAmountIn(
        BigNumber.from(0),
        BigNumber.from(100),
        BigNumber.from(100)
      )
    ).to.be.revertedWith("UniswapV2Library: INSUFFICIENT_OUTPUT_AMOUNT");
    await expect(
      router.getAmountIn(
        BigNumber.from(1),
        BigNumber.from(0),
        BigNumber.from(100)
      )
    ).to.be.revertedWith("UniswapV2Library: INSUFFICIENT_LIQUIDITY");
    await expect(
      router.getAmountIn(
        BigNumber.from(1),
        BigNumber.from(100),
        BigNumber.from(0)
      )
    ).to.be.revertedWith("UniswapV2Library: INSUFFICIENT_LIQUIDITY");
  });

  it.skip("getAmountsOut", async () => {
    const {
      router02: router,
      token0,
      token1,
      wallet,
    } = await deploy();

    await(await token0.approve(router.address, ethers.constants.MaxUint256)).wait();
    await(await token1.approve(router.address, ethers.constants.MaxUint256)).wait();
    await(await router.addLiquidity(
      token0.address,
      token1.address,
      BigNumber.from(10000),
      BigNumber.from(10000),
      0,
      0,
      wallet.address,
      ethers.constants.MaxUint256,
      GAS_LIMIT
    )).wait();

    await expect(
      router.getAmountsOut(BigNumber.from(2), [token0.address])
    ).to.be.revertedWith("UniswapV2Library: INVALID_PATH");
    const path = [token0.address, token1.address];
    expect(await router.getAmountsOut(BigNumber.from(2), path)).to.deep.eq([
      BigNumber.from(2),
      BigNumber.from(1),
    ]);
  });

  it.skip("getAmountsIn", async () => {
    const {
      router02: router,
      token0,
      token1,
      wallet,
    } = await deploy();

    await(await token0.approve(router.address, ethers.constants.MaxUint256)).wait();
    await(await token1.approve(router.address, ethers.constants.MaxUint256)).wait();
    await(await router.addLiquidity(
      token0.address,
      token1.address,
      BigNumber.from(10000),
      BigNumber.from(10000),
      0,
      0,
      wallet.address,
      ethers.constants.MaxUint256,
      GAS_LIMIT
    )).wait();

    await expect(
      router.getAmountsIn(BigNumber.from(1), [token0.address])
    ).to.be.revertedWith("UniswapV2Library: INVALID_PATH");
    const path = [token0.address, token1.address];
    expect(await router.getAmountsIn(BigNumber.from(1), path)).to.deep.eq([
      BigNumber.from(2),
      BigNumber.from(1),
    ]);
  });

  it.skip("factory, WETH", async () => {
    const { router02, factoryV2, WETH } = await deploy();
    expect(await router02.factory()).to.eq(factoryV2.address);
    expect(await router02.WETH()).to.eq(WETH.address);
  });

  // replace MKNToken with uniswap ERC so that test can catch events only for this test file. 
  // so no mint needed.

  it.skip("addLiquidity", async () => {
    const { router02, token0, token1, wallet, pair } = await deploy()

    const token0Amount = expandTo18Decimals(1);
    const token1Amount = expandTo18Decimals(4);

    const expectedLiquidity = expandTo18Decimals(2);
    await(await token0.approve(router02.address, ethers.constants.MaxUint256)).wait();
    await(await token1.approve(router02.address, ethers.constants.MaxUint256)).wait();

    console.log("balance 0: ", await token0.balanceOf(wallet.address))
    console.log("balance 1: ", await token1.balanceOf(wallet.address))
    console.log("balance 0: ", await token0.allowance(wallet.address, router02.address))
    console.log("balance 1: ", await token1.allowance(wallet.address, router02.address))

    await expect(router02.addLiquidity(
      token0.address,
      token1.address,
      token0Amount,
      token1Amount,
      0,
      0,
      wallet.address,
      ethers.constants.MaxUint256,
      GAS_LIMIT
    ))
      .to.emit(token0, "Transfer")
      .withArgs(wallet.address, pair.address, token0Amount)
      .to.emit(token1, "Transfer")
      .withArgs(wallet.address, pair.address, token1Amount)
      .to.emit(pair, "Transfer")
      .withArgs(
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        MINIMUM_LIQUIDITY
      )
      .to.emit(pair, "Transfer")
      .withArgs(
        ethers.constants.AddressZero,
        wallet.address,
        expectedLiquidity.sub(MINIMUM_LIQUIDITY)
      )
      .to.emit(pair, "Sync")
      .withArgs(token0Amount, token1Amount)
      .to.emit(pair, "Mint")
      .withArgs(router02.address, token0Amount, token1Amount);

    expect(await pair.balanceOf(wallet.address)).to.eq(
      expectedLiquidity.sub(MINIMUM_LIQUIDITY)
    );
  }).timeout(100000);

  it.skip("removeLiquidity", async () => {
    const { router02, token0, token1, wallet, pair } = await deploy()

    const token0Amount = expandTo18Decimals(1);
    const token1Amount = expandTo18Decimals(4);
    await(await token0.transfer(pair.address, token0Amount)).wait();
    await(await token1.transfer(pair.address, token1Amount)).wait();
    await(await pair.mint(wallet.address)).wait();

    const expectedLiquidity = expandTo18Decimals(2);
    await(await pair.approve(router02.address, ethers.constants.MaxUint256)).wait();
    await expect(
      router02.removeLiquidity(
        token0.address,
        token1.address,
        expectedLiquidity.sub(MINIMUM_LIQUIDITY),
        0,
        0,
        wallet.address,
        ethers.constants.MaxUint256,
        GAS_LIMIT
      )
    )
      .to.emit(pair, "Transfer")
      .withArgs(
        wallet.address,
        pair.address,
        expectedLiquidity.sub(MINIMUM_LIQUIDITY)
      )
      .to.emit(pair, "Transfer")
      .withArgs(
        pair.address,
        ethers.constants.AddressZero,
        expectedLiquidity.sub(MINIMUM_LIQUIDITY)
      )
      .to.emit(token0, "Transfer")
      .withArgs(pair.address, wallet.address, token0Amount.sub(500))
      .to.emit(token1, "Transfer")
      .withArgs(pair.address, wallet.address, token1Amount.sub(2000))
      .to.emit(pair, "Sync")
      .withArgs(500, 2000)
      .to.emit(pair, "Burn")
      .withArgs(
        router02.address,
        token0Amount.sub(500),
        token1Amount.sub(2000),
        wallet.address
      );

    expect(await pair.balanceOf(wallet.address)).to.eq(0);
    const totalSupplyToken0 = await token0.totalSupply();
    const totalSupplyToken1 = await token1.totalSupply();
    expect(await token0.balanceOf(wallet.address)).to.eq(
      totalSupplyToken0.sub(500)
    );
    expect(await token1.balanceOf(wallet.address)).to.eq(
      totalSupplyToken1.sub(2000)
    );
  }).timeout(100000);

  it.skip("removeLiquidityETH", async () => {
    const {
      router02,
      wallet,
      WETHPartner,
      WETH,
      wethPair: WETHPair,
    } = await deploy();

    const WETHPartnerAmount = expandTo18Decimals(1);
    const ETHAmount = expandTo18Decimals(4);
    await(await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)).wait();
    await(await WETH.deposit({ value: ETHAmount })).wait();
    await(await WETH.transfer(WETHPair.address, ETHAmount)).wait();
    await(await WETHPair.mint(wallet.address)).wait();

    const expectedLiquidity = expandTo18Decimals(2);
    const WETHPairToken0 = await WETHPair.token0();
    await(await WETHPair.approve(router02.address, ethers.constants.MaxUint256)).wait();
    await expect(
      router02.removeLiquidityETH(
        WETHPartner.address,
        expectedLiquidity.sub(MINIMUM_LIQUIDITY),
        0,
        0,
        wallet.address,
        ethers.constants.MaxUint256,
        GAS_LIMIT
      )
    )
      .to.emit(WETHPair, "Transfer")
      .withArgs(
        wallet.address,
        WETHPair.address,
        expectedLiquidity.sub(MINIMUM_LIQUIDITY)
      )
      .to.emit(WETHPair, "Transfer")
      .withArgs(
        WETHPair.address,
        ethers.constants.AddressZero,
        expectedLiquidity.sub(MINIMUM_LIQUIDITY)
      )
      .to.emit(WETH, "Transfer")
      .withArgs(WETHPair.address, router02.address, ETHAmount.sub(2000))
      .to.emit(WETHPartner, "Transfer")
      .withArgs(WETHPair.address, router02.address, WETHPartnerAmount.sub(500))
      .to.emit(WETHPartner, "Transfer")
      .withArgs(router02.address, wallet.address, WETHPartnerAmount.sub(500))
      .to.emit(WETHPair, "Sync")
      .withArgs(
        WETHPairToken0 === WETHPartner.address ? 500 : 2000,
        WETHPairToken0 === WETHPartner.address ? 2000 : 500
      )
      .to.emit(WETHPair, "Burn")
      .withArgs(
        router02.address,
        WETHPairToken0 === WETHPartner.address
          ? WETHPartnerAmount.sub(500)
          : ETHAmount.sub(2000),
        WETHPairToken0 === WETHPartner.address
          ? ETHAmount.sub(2000)
          : WETHPartnerAmount.sub(500),
        router02.address
      );

    expect(await WETHPair.balanceOf(wallet.address)).to.eq(0);
    const totalSupplyWETHPartner = await WETHPartner.totalSupply();
    const totalSupplyWETH = await WETH.totalSupply();
    expect(await WETHPartner.balanceOf(wallet.address)).to.eq(
      totalSupplyWETHPartner.sub(500)
    );
    expect(await WETH.balanceOf(wallet.address)).to.eq(
      totalSupplyWETH.sub(2000)
    );
  }).timeout(100000);

  it.skip("removeLiquidityWithPermit", async () => {
    const { router02, token0, token1, wallet, pair } = await deploy()

    const token0Amount = expandTo18Decimals(1);
    const token1Amount = expandTo18Decimals(4);
    await(await token0.transfer(pair.address, token0Amount)).wait();
    await(await token1.transfer(pair.address, token1Amount)).wait();
    await(await pair.mint(wallet.address)).wait();

    const expectedLiquidity = expandTo18Decimals(2);

    const nonce = await pair.nonces(wallet.address);
    const tokenName = await pair.name();
    const chainId = await wallet.getChainId();
    const sig = await wallet._signTypedData(
      // "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
      {
        name: tokenName,
        version: UniswapVersion,
        chainId: chainId,
        verifyingContract: pair.address,
      },
      // "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
      {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      {
        owner: wallet.address,
        spender: router02.address,
        value: expectedLiquidity.sub(MINIMUM_LIQUIDITY),
        nonce: nonce,
        deadline: ethers.constants.MaxUint256,
      }
    );

    const { r, s, v } = ethers.utils.splitSignature(sig);

    await(await router02.removeLiquidityWithPermit(
      token0.address,
      token1.address,
      expectedLiquidity.sub(MINIMUM_LIQUIDITY),
      0,
      0,
      wallet.address,
      ethers.constants.MaxUint256,
      false,
      v,
      r,
      s,
      GAS_LIMIT
    )).wait();
  });

  it.skip("removeLiquidityETHWithPermit", async () => {
    const { router02, wallet, WETHPartner, wethPair, WETH } = await deploy()

    const WETHPartnerAmount = expandTo18Decimals(1);
    const ETHAmount = expandTo18Decimals(4);
    await(await WETHPartner.transfer(wethPair.address, WETHPartnerAmount)).wait();
    await(await WETH.deposit({ value: ETHAmount })).wait();
    await(await WETH.transfer(wethPair.address, ETHAmount)).wait();
    await(await wethPair.mint(wallet.address)).wait();

    const expectedLiquidity = expandTo18Decimals(2);

    const nonce = await wethPair.nonces(wallet.address);

    const tokenName = await wethPair.name();
    const chainId = await wallet.getChainId();

    const sig = await wallet._signTypedData(
      // "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
      {
        name: tokenName,
        version: UniswapVersion,
        chainId: chainId,
        verifyingContract: wethPair.address,
      },
      // "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
      {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      {
        owner: wallet.address,
        spender: router02.address,
        value: expectedLiquidity.sub(MINIMUM_LIQUIDITY),
        nonce: nonce,
        deadline: ethers.constants.MaxUint256,
      }
    );

    const { r, s, v } = ethers.utils.splitSignature(sig);

    await(await router02.removeLiquidityETHWithPermit(
      WETHPartner.address,
      expectedLiquidity.sub(MINIMUM_LIQUIDITY),
      0,
      0,
      wallet.address,
      ethers.constants.MaxUint256,
      false,
      v,
      r,
      s,
      GAS_LIMIT
    )).wait();
  });

  describe.skip("swapExactTokensForTokens", () => {
    const token0Amount = expandTo18Decimals(5);
    const token1Amount = expandTo18Decimals(10);
    const swapAmount = expandTo18Decimals(1);
    const expectedOutputAmount = BigNumber.from("1662497915624478906");

    it("happy path", async () => {
      const { router02, token0, token1, wallet, pair } = await deploy()

      // before each
      await(await token0.transfer(pair.address, token0Amount)).wait();
      await(await token1.transfer(pair.address, token1Amount)).wait();
      await(await pair.mint(wallet.address)).wait();

      await(await token0.approve(router02.address, ethers.constants.MaxUint256)).wait();

      await expect(
        router02.swapExactTokensForTokens(
          swapAmount,
          0,
          [token0.address, token1.address],
          wallet.address,
          ethers.constants.MaxUint256,
          GAS_LIMIT
        )
      )
        .to.emit(token0, "Transfer")
        .withArgs(wallet.address, pair.address, swapAmount)
        .to.emit(token1, "Transfer")
        .withArgs(pair.address, wallet.address, expectedOutputAmount)
        .to.emit(pair, "Sync")
        .withArgs(
          token0Amount.add(swapAmount),
          token1Amount.sub(expectedOutputAmount)
        )
        .to.emit(pair, "Swap")
        .withArgs(
          router02.address,
          swapAmount,
          0,
          0,
          expectedOutputAmount,
          wallet.address
        );
    }).timeout(100000);

    it("amounts", async () => {
      const { router02, token0, token1, wallet, pair, RouterEmit } =
        await deploy();

      // before each
      await(await token0.transfer(pair.address, token0Amount)).wait();
      await(await token1.transfer(pair.address, token1Amount)).wait();
      await(await pair.mint(wallet.address)).wait();
      await(await token0.approve(router02.address, ethers.constants.MaxUint256)).wait();

      await(await token0.approve(RouterEmit.address, ethers.constants.MaxUint256)).wait();
      await expect(
        RouterEmit.swapExactTokensForTokens(
          router02.address,
          swapAmount,
          0,
          [token0.address, token1.address],
          wallet.address,
          ethers.constants.MaxUint256,
          GAS_LIMIT
        )
      )
        .to.emit(RouterEmit, "Amounts")
        .withArgs([swapAmount, expectedOutputAmount]);
    }).timeout(100000);
  });

  describe.skip("swapTokensForExactTokens", () => {
    const token0Amount = expandTo18Decimals(5);
    const token1Amount = expandTo18Decimals(10);
    const expectedSwapAmount = BigNumber.from("557227237267357629");
    const outputAmount = expandTo18Decimals(1);

    it("happy path", async () => {
      const { router02, token0, token1, wallet, pair } = await deploy()

      // before each
      await(await token0.transfer(pair.address, token0Amount)).wait();
      await(await token1.transfer(pair.address, token1Amount)).wait();
      await(await pair.mint(wallet.address)).wait();

      await(await token0.approve(router02.address, ethers.constants.MaxUint256)).wait();
      await expect(
        router02.swapTokensForExactTokens(
          outputAmount,
          ethers.constants.MaxUint256,
          [token0.address, token1.address],
          wallet.address,
          ethers.constants.MaxUint256,
          GAS_LIMIT
        )
      )
        .to.emit(token0, "Transfer")
        .withArgs(wallet.address, pair.address, expectedSwapAmount)
        .to.emit(token1, "Transfer")
        .withArgs(pair.address, wallet.address, outputAmount)
        .to.emit(pair, "Sync")
        .withArgs(
          token0Amount.add(expectedSwapAmount),
          token1Amount.sub(outputAmount)
        )
        .to.emit(pair, "Swap")
        .withArgs(
          router02.address,
          expectedSwapAmount,
          0,
          0,
          outputAmount,
          wallet.address
        );
    }).timeout(100000);;

    it("amounts", async () => {
      const { router02, token0, token1, wallet, pair, RouterEmit } =
        await deploy();

      // before each
      await(await token0.transfer(pair.address, token0Amount)).wait();
      await(await token1.transfer(pair.address, token1Amount)).wait();
      await(await pair.mint(wallet.address)).wait();

      await(await token0.approve(RouterEmit.address, ethers.constants.MaxUint256)).wait();
      await expect(
        RouterEmit.swapTokensForExactTokens(
          router02.address,
          outputAmount,
          ethers.constants.MaxUint256,
          [token0.address, token1.address],
          wallet.address,
          ethers.constants.MaxUint256,
          GAS_LIMIT
        )
      )
        .to.emit(RouterEmit, "Amounts")
        .withArgs([expectedSwapAmount, outputAmount]);
    }).timeout(100000);
  });

  describe.skip("swapExactETHForTokens", () => {
    const WETHPartnerAmount = expandTo18Decimals(10);
    const ETHAmount = expandTo18Decimals(5);
    const swapAmount = expandTo18Decimals(1);
    const expectedOutputAmount = BigNumber.from("1662497915624478906");

    it("happy path", async () => {
      const {
        router02,
        token0,
        wallet,
        WETHPartner,
        wethPair: WETHPair,
        WETH,
      } = await deploy();

      // before each
      await(await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)).wait();
      await(await WETH.deposit({ value: ETHAmount })).wait();
      await(await WETH.transfer(WETHPair.address, ETHAmount)).wait();
      await(await WETHPair.mint(wallet.address)).wait();
      await(await token0.approve(router02.address, ethers.constants.MaxUint256)).wait();

      const WETHPairToken0 = await WETHPair.token0();
      await expect(
        router02.swapExactETHForTokens(
          0,
          [WETH.address, WETHPartner.address],
          wallet.address,
          ethers.constants.MaxUint256,
          {
            value: swapAmount,
            gasLimit: ethers.BigNumber.from(1000000)
          }
        )
      )
        .to.emit(WETH, "Transfer")
        .withArgs(router02.address, WETHPair.address, swapAmount)
        .to.emit(WETHPartner, "Transfer")
        .withArgs(WETHPair.address, wallet.address, expectedOutputAmount)
        .to.emit(WETHPair, "Sync")
        .withArgs(
          WETHPairToken0 === WETHPartner.address
            ? WETHPartnerAmount.sub(expectedOutputAmount)
            : ETHAmount.add(swapAmount),
          WETHPairToken0 === WETHPartner.address
            ? ETHAmount.add(swapAmount)
            : WETHPartnerAmount.sub(expectedOutputAmount)
        )
        .to.emit(WETHPair, "Swap")
        .withArgs(
          router02.address,
          WETHPairToken0 === WETHPartner.address ? 0 : swapAmount,
          WETHPairToken0 === WETHPartner.address ? swapAmount : 0,
          WETHPairToken0 === WETHPartner.address ? expectedOutputAmount : 0,
          WETHPairToken0 === WETHPartner.address ? 0 : expectedOutputAmount,
          wallet.address
        );
    }).timeout(100000);;

    it("amounts", async () => {
      const {
        router02,
        token0,
        wallet,
        WETHPartner,
        wethPair: WETHPair,
        WETH,
        RouterEmit,
      } = await deploy();

      // before each
      await(await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)).wait();
      await(await WETH.deposit({ value: ETHAmount })).wait();
      await(await WETH.transfer(WETHPair.address, ETHAmount)).wait();
      await(await WETHPair.mint(wallet.address)).wait();
      await(await token0.approve(router02.address, ethers.constants.MaxUint256)).wait();

      await expect(
        RouterEmit.swapExactETHForTokens(
          router02.address,
          0,
          [WETH.address, WETHPartner.address],
          wallet.address,
          ethers.constants.MaxUint256,
          {
            value: swapAmount,
            gasLimit: ethers.BigNumber.from(1000000)
          }
        )
      )
        .to.emit(RouterEmit, "Amounts")
        .withArgs([swapAmount, expectedOutputAmount]);
    }).timeout(100000);
  });

  describe("swapTokensForExactETH", () => {
    const WETHPartnerAmount = expandTo18Decimals(5);
    const ETHAmount = expandTo18Decimals(10);
    const expectedSwapAmount = BigNumber.from("557227237267357629");
    const outputAmount = expandTo18Decimals(1);

    it("happy path", async () => {
      const {
        router02,
        wallet,
        WETHPartner,
        wethPair: WETHPair,
        WETH,
      } = await deploy();

      // before each
      await(await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)).wait();
      await(await WETH.deposit({ value: ETHAmount })).wait();
      await(await WETH.transfer(WETHPair.address, ETHAmount)).wait();
      await(await WETHPair.mint(wallet.address)).wait();

      await(await WETHPartner.approve(router02.address, ethers.constants.MaxUint256)).wait();
      const WETHPairToken0 = await WETHPair.token0();
      await expect(
        router02.swapTokensForExactETH(
          outputAmount,
          ethers.constants.MaxUint256,
          [WETHPartner.address, WETH.address],
          wallet.address,
          ethers.constants.MaxUint256,
          GAS_LIMIT
        )
      )
        .to.emit(WETHPartner, "Transfer")
        .withArgs(wallet.address, WETHPair.address, expectedSwapAmount)
        .to.emit(WETH, "Transfer")
        .withArgs(WETHPair.address, router02.address, outputAmount)
        .to.emit(WETHPair, "Sync")
        .withArgs(
          WETHPairToken0 === WETHPartner.address
            ? WETHPartnerAmount.add(expectedSwapAmount)
            : ETHAmount.sub(outputAmount),
          WETHPairToken0 === WETHPartner.address
            ? ETHAmount.sub(outputAmount)
            : WETHPartnerAmount.add(expectedSwapAmount)
        )
        .to.emit(WETHPair, "Swap")
        .withArgs(
          router02.address,
          WETHPairToken0 === WETHPartner.address ? expectedSwapAmount : 0,
          WETHPairToken0 === WETHPartner.address ? 0 : expectedSwapAmount,
          WETHPairToken0 === WETHPartner.address ? 0 : outputAmount,
          WETHPairToken0 === WETHPartner.address ? outputAmount : 0,
          router02.address
        );
    }).timeout(150000);

    it("amounts", async () => {
      const {
        router02,
        wallet,
        WETHPartner,
        wethPair: WETHPair,
        WETH,
        RouterEmit,
      } = await deploy();

      // before each
      await(await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)).wait();
      await(await WETH.deposit({ value: ETHAmount })).wait();
      await(await WETH.transfer(WETHPair.address, ETHAmount)).wait();
      await(await WETHPair.mint(wallet.address)).wait();

      await(await WETHPartner.approve(
        RouterEmit.address,
        ethers.constants.MaxUint256
      )).wait();
      await expect(
        RouterEmit.swapTokensForExactETH(
          router02.address,
          outputAmount,
          ethers.constants.MaxUint256,
          [WETHPartner.address, WETH.address],
          wallet.address,
          ethers.constants.MaxUint256,
          GAS_LIMIT
        )
      )
        .to.emit(RouterEmit, "Amounts")
        .withArgs([expectedSwapAmount, outputAmount]);
    }).timeout(150000);
  });

  describe("swapExactTokensForETH", () => {
    const WETHPartnerAmount = expandTo18Decimals(5);
    const ETHAmount = expandTo18Decimals(10);
    const swapAmount = expandTo18Decimals(1);
    const expectedOutputAmount = BigNumber.from("1662497915624478906");

    it("happy path", async () => {
      const {
        router02,
        wallet,
        WETHPartner,
        wethPair: WETHPair,
        WETH,
      } = await deploy();

      //before each
      await(await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)).wait();
      await(await WETH.deposit({ value: ETHAmount })).wait();
      await(await WETH.transfer(WETHPair.address, ETHAmount)).wait();
      await(await WETHPair.mint(wallet.address)).wait();

      await(await WETHPartner.approve(router02.address, ethers.constants.MaxUint256)).wait();
      const WETHPairToken0 = await WETHPair.token0();
      await expect(
        router02.swapExactTokensForETH(
          swapAmount,
          0,
          [WETHPartner.address, WETH.address],
          wallet.address,
          ethers.constants.MaxUint256,
          GAS_LIMIT
        )
      )
        .to.emit(WETHPartner, "Transfer")
        .withArgs(wallet.address, WETHPair.address, swapAmount)
        .to.emit(WETH, "Transfer")
        .withArgs(WETHPair.address, router02.address, expectedOutputAmount)
        .to.emit(WETHPair, "Sync")
        .withArgs(
          WETHPairToken0 === WETHPartner.address
            ? WETHPartnerAmount.add(swapAmount)
            : ETHAmount.sub(expectedOutputAmount),
          WETHPairToken0 === WETHPartner.address
            ? ETHAmount.sub(expectedOutputAmount)
            : WETHPartnerAmount.add(swapAmount)
        )
        .to.emit(WETHPair, "Swap")
        .withArgs(
          router02.address,
          WETHPairToken0 === WETHPartner.address ? swapAmount : 0,
          WETHPairToken0 === WETHPartner.address ? 0 : swapAmount,
          WETHPairToken0 === WETHPartner.address ? 0 : expectedOutputAmount,
          WETHPairToken0 === WETHPartner.address ? expectedOutputAmount : 0,
          router02.address
        );
    }).timeout(100000);

    it("amounts", async () => {
      const {
        router02,
        wallet,
        WETHPartner,
        wethPair: WETHPair,
        WETH,
        RouterEmit,
      } = await deploy();

      //before each
      await(await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)).wait();
      await(await WETH.deposit({ value: ETHAmount })).wait();
      await(await WETH.transfer(WETHPair.address, ETHAmount)).wait();
      await(await WETHPair.mint(wallet.address)).wait();

      await(await WETHPartner.approve(
        RouterEmit.address,
        ethers.constants.MaxUint256
      )).wait();
      await expect(
        RouterEmit.swapExactTokensForETH(
          router02.address,
          swapAmount,
          0,
          [WETHPartner.address, WETH.address],
          wallet.address,
          ethers.constants.MaxUint256,
          GAS_LIMIT
        )
      )
        .to.emit(RouterEmit, "Amounts")
        .withArgs([swapAmount, expectedOutputAmount]);
    }).timeout(150000);;
  });

  describe("swapETHForExactTokens", () => {
    const WETHPartnerAmount = expandTo18Decimals(10);
    const ETHAmount = expandTo18Decimals(5);
    const expectedSwapAmount = BigNumber.from("557227237267357629");
    const outputAmount = expandTo18Decimals(1);

    it("happy path", async () => {
      const {
        router02,
        wallet,
        WETHPartner,
        wethPair: WETHPair,
        WETH,
      } = await deploy();

      await(await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)).wait();
      await(await WETH.deposit({ value: ETHAmount }).wait());
      await(await WETH.transfer(WETHPair.address, ETHAmount).wait());
      await(await WETHPair.mint(wallet.address)).wait();

      const WETHPairToken0 = await WETHPair.token0();
      await expect(
        router02.swapETHForExactTokens(
          outputAmount,
          [WETH.address, WETHPartner.address],
          wallet.address,
          ethers.constants.MaxUint256,
          {
            value: expectedSwapAmount,
            gasLimit: ethers.BigNumber.from(1000000)
          }
        )
      )
        .to.emit(WETH, "Transfer")
        .withArgs(router02.address, WETHPair.address, expectedSwapAmount)
        .to.emit(WETHPartner, "Transfer")
        .withArgs(WETHPair.address, wallet.address, outputAmount)
        .to.emit(WETHPair, "Sync")
        .withArgs(
          WETHPairToken0 === WETHPartner.address
            ? WETHPartnerAmount.sub(outputAmount)
            : ETHAmount.add(expectedSwapAmount),
          WETHPairToken0 === WETHPartner.address
            ? ETHAmount.add(expectedSwapAmount)
            : WETHPartnerAmount.sub(outputAmount)
        )
        .to.emit(WETHPair, "Swap")
        .withArgs(
          router02.address,
          WETHPairToken0 === WETHPartner.address ? 0 : expectedSwapAmount,
          WETHPairToken0 === WETHPartner.address ? expectedSwapAmount : 0,
          WETHPairToken0 === WETHPartner.address ? outputAmount : 0,
          WETHPairToken0 === WETHPartner.address ? 0 : outputAmount,
          wallet.address
        );
    }).timeout(150000);

    it("amounts", async () => {
      const {
        router02,
        wallet,
        WETHPartner,
        wethPair: WETHPair,
        WETH,
        RouterEmit,
      } = await deploy();

      await(await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)).wait();
      await(await WETH.deposit({ value: ETHAmount })).wait();
      await(await WETH.transfer(WETHPair.address, ETHAmount)).wait();
      await(await WETHPair.mint(wallet.address)).wait();

      await expect(
        RouterEmit.swapETHForExactTokens(
          router02.address,
          outputAmount,
          [WETH.address, WETHPartner.address],
          wallet.address,
          ethers.constants.MaxUint256,
          {
            value: expectedSwapAmount,
            gasLimit: ethers.BigNumber.from(1000000)
          }
        )
      )
        .to.emit(RouterEmit, "Amounts")
        .withArgs([expectedSwapAmount, outputAmount]);
    }).timeout(150000);
  });
});
