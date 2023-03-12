import { useEffect, useState, useRef } from "react";
import {
  Flex,
  Box,
  Button,
  Input,
  useDisclosure,
  Text,
  useColorMode,
  HStack,
  VStack,
  useMediaQuery,
} from "@chakra-ui/react";
import { SettingsIcon, ArrowDownIcon } from "@chakra-ui/icons";

import {
  useEthers,
  TransactionOptions,
  useContractFunction,
  ERC20Interface,
  useEtherBalance,
  useTokenBalance,
  useTokenAllowance
} from "@usedapp/core";

import { BigNumber, constants, Contract } from 'ethers';
import { Web3Provider, Provider} from 'zksync-web3';

import SwapButton from "./SwapButton";
import TokenSelect from "./TokenSelect";
import TokenModal from "./Modal/TokenModal";
import { Token } from "../common/Token";

import {
  _quoteSwap, 
  _swapETHForToken, 
  _swapTokenForETH, 
  _swapTokenForToken
} from "../common/swapRouter"

import {
  _swapETHForTokenAA,
  _swapTokenForETHAA,
  _swapTokenForTokenAA
} from "../common/swapModule"

import { 
  _checkTradeLimit,
  _dailyTradeLimit,
  _isDailyTradeLimitEnabled,
  _maxTradeAmountUSD,
  _isAssetWhitelisted,
  _getPrice
 } from "../common/swapModuleBase"
import { _isGasPayablePath } from "../common/gasPond"
import { address } from "../common/address"
import { ZkSyncLocal } from "../common/zkSyncLocal";

type Props = {
  CAAddress: string
  isCA: any
};

export default function Trade({CAAddress, isCA} : Props) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { account, chainId } = useEthers();
  const { colorMode } = useColorMode();

  const [tokenIn, setTokenIn] = useState<Token | null>(null);
  const [tokenOut, setTokenOut] = useState<Token | null>(null);
  const [tokenInQuantity, setTokenInQuantity] = useState<BigInt>(BigInt(0));

  const [estimatedQuote, setEstimatedQuote] = useState<number>(0);
  const [quotedExchangeRate, setQuotedExchangeRate] = useState<number>(0);
  const [disabled, setDisabled] = useState<boolean>(false);

  //const provider = new Provider(ZkSyncLocal.rpcUrl);
  const signer = (new Web3Provider(window.ethereum)).getSigner();
  const txnOpts: TransactionOptions | undefined = signer
    ? { signer: signer }
    : undefined;

  const readableTokenInQuantity =
    tokenInQuantity && tokenIn
      ? Number(
          tokenInQuantity.valueOf() /
            BigInt(10 ** Math.max(0, tokenIn.decimals - 10))
        ) /
        10 ** Math.min(tokenIn.decimals, 10)
      : 0;

  const isNativeTokenIn =
  tokenIn?.getAddressFromEncodedTokenName() === "native";

  const isNativeTokenOut =
  tokenOut?.getAddressFromEncodedTokenName() === "native";
  
  const etherBalance = useEtherBalance((isCA ? CAAddress: account));

  const tokenInErc20Balance: BigNumber | undefined = useTokenBalance(
    isNativeTokenIn === false
      ? tokenIn?.getAddressFromEncodedTokenName()
      : undefined,
      isCA ? CAAddress : account
  );

  const tokenInBalance = 
  isNativeTokenIn === false
      ? tokenInErc20Balance?.toBigInt()
      : chainId === ZkSyncLocal.chainId
      ? etherBalance?.toBigInt()
      : undefined;

  const readableTokenINBalance = tokenInBalance
    ? Number(tokenInBalance / BigInt(10 ** (tokenIn?.decimals - 4))) / 10000
    : 0;

  const userHasSufficientBalance =
    tokenIn && tokenInBalance ? tokenInBalance >= tokenInQuantity : false;
    
  const tokenOutErc20Balance: BigNumber | undefined = useTokenBalance(
    isNativeTokenOut === false
      ? tokenOut?.getAddressFromEncodedTokenName()
      : undefined,
      isCA ? CAAddress : account
  );

  const tokenOutBalance =
  isNativeTokenOut === false
      ? tokenOutErc20Balance?.toBigInt()
      : chainId === ZkSyncLocal.chainId
      ? etherBalance?.toBigInt()
      : undefined;

  const readableTokenBalance = tokenOutBalance
    ? Number(tokenOutBalance / BigInt(10 ** (tokenOut?.decimals - 4))) / 10000
    : 0;

  const tokenInAllowance = useTokenAllowance(
    isNativeTokenIn === false 
        ? tokenIn?.getAddressFromEncodedTokenName() : undefined,
        isCA ? CAAddress : account as string,
        address.router
  )

  const userHasSufficcientAllowance = tokenInAllowance && BigNumber.from(0)
  ? tokenInAllowance?.toBigInt() >= tokenInQuantity
  : isNativeTokenIn === true;

  const erc20GasPayable = _isGasPayablePath(
   isNativeTokenIn === false
     ? tokenIn?.getAddressFromEncodedTokenName() : address.weth, 
   isNativeTokenOut === false
     ? tokenOut?.getAddressFromEncodedTokenName() : address.weth,  
    address.sponsor1, 
    isCA ? CAAddress : account as string 
    )
  
  const isErc20GasPayable = erc20GasPayable ? erc20GasPayable : false;

  const tradeLimitResult = _checkTradeLimit(
    isCA ? CAAddress : account as string,
    isNativeTokenIn === false
      ? tokenIn?.getAddressFromEncodedTokenName() : address.weth, 
      BigNumber.from(tokenInQuantity),
     )

  const dailyTradeLimit = _dailyTradeLimit()
  const maxTradeAmountUSD = _maxTradeAmountUSD()
  const isAssetWhitelisted: boolean | undefined = _isAssetWhitelisted(
    isNativeTokenIn === false
    ? tokenIn?.getAddressFromEncodedTokenName() : address.weth
  )

  
  const resetTime = tradeLimitResult ? tradeLimitResult[2] : undefined;
  const hasSufficientLimit = 
   tradeLimitResult && tradeLimitResult[0] != undefined && (
    resetTime == 0 ? true : tradeLimitResult[0]
   )

  const availabileAmount =
   tradeLimitResult && tradeLimitResult[1] && ( 
    resetTime == 0 ? dailyTradeLimit : tradeLimitResult[1]
   )

  const tokenInPrice: number | undefined = _getPrice(
    isNativeTokenIn === false
    ? tokenIn?.getAddressFromEncodedTokenName() : address.weth
    )

    // _isAssetWhitelisted

  const tokenInValue: number | undefined = 
    tokenInQuantity && tokenInPrice
    ? (Number(tokenInQuantity) / 1e18 * tokenInPrice)
    : undefined;

  const estimatedAvailableAmount = 
  availabileAmount && tokenInValue 
  ? (availabileAmount / 1e18) - tokenInValue
  : undefined;

  const hasExceedMaxTradeSize: boolean | undefined = 
  tokenInValue && maxTradeAmountUSD ? (tokenInValue >= (maxTradeAmountUSD/1e18)) ? true : false : undefined;

  const activatedIsTokenModal = useRef(true); 

  // ERC20 & Approval 
  const erc20Contract: any =
  tokenIn && tokenIn.getAddressFromEncodedTokenName() !== "native"
    ? (new Contract(
        tokenIn.getAddressFromEncodedTokenName(),
        ERC20Interface
      ) as any)
    : null;

  const { send: erc20Send } = useContractFunction(
    erc20Contract,
    "approve",
    txnOpts
  );

  async function approveToken() {
    erc20Send(address.router, constants.MaxUint256)
  }

  async function startSwap() {
    let tokenInAddress = tokenIn!.getAddressFromEncodedTokenName();
    let tokenOutAddress = tokenOut!.getAddressFromEncodedTokenName();
    let receipt;
    let tx;

    setDisabled(true);
    if (tokenInAddress === "native") {
      if (isErc20GasPayable && isCA) {
        tx = await _swapETHForTokenAA(
          tokenOutAddress, 
          tokenInQuantity,
          CAAddress,
          false
        )
      } else {
        tx = await _swapETHForToken(
          tokenOutAddress, 
          tokenInQuantity,
          account
        )
      }

    } else if (tokenOutAddress == "native") {
      if (isErc20GasPayable && isCA) {
        tx = await _swapTokenForETHAA(
          tokenInAddress, 
          tokenInQuantity,
          CAAddress,
          false
        )
      } else {
        tx = await _swapTokenForETH(
          tokenInAddress,
          tokenInQuantity,
          account
        )
      } 
    } else {
      if (isErc20GasPayable && isCA) {
        tx = await _swapTokenForTokenAA(
          tokenInAddress, 
          tokenOutAddress,
          tokenInQuantity,
          CAAddress,
          false
        )
      } else {
        tx = await _swapTokenForToken(
          tokenInAddress,
          tokenOutAddress,
          tokenInQuantity,
          account
        )
      } 
    }

    receipt = await tx.wait()
    console.log("swap transaction receipt =", receipt);

    setDisabled(false);
  }

  useEffect(() => {
    const timeOutId = setTimeout(async () => {
      if (tokenIn && tokenOut && tokenInQuantity > BigInt(0)) {
        let rawQuote = await _quoteSwap(
          tokenIn?.getAddressFromEncodedTokenName() as string,
          tokenOut?.getAddressFromEncodedTokenName() as string,
          tokenInQuantity as BigInt
        );
        let quote = Number(rawQuote) / 10 ** tokenOut.decimals;
  
        setEstimatedQuote(quote);
      }
    }, 300);
    return () => clearTimeout(timeOutId);
  }, [tokenInQuantity, tokenIn, tokenOut]);

  useEffect(() => {
    const timeOutId = setTimeout(async () => {
      if (tokenIn && tokenOut) {
        let rawQuote = await _quoteSwap(
          tokenIn?.getAddressFromEncodedTokenName(),
          tokenOut?.getAddressFromEncodedTokenName(),
          BigInt(10 ** tokenIn.decimals)
        );
        let quote = Number(rawQuote) / 10 ** tokenOut.decimals;
        setQuotedExchangeRate(quote);
      }
    }, 300);
    return () => clearTimeout(timeOutId);
}, [tokenIn, tokenOut]);

  const [isScreenFullWidth] = useMediaQuery("(min-width: 475px)");

  return (
    <Box
      w={isScreenFullWidth ? "475px" : "calc(98vw)"}
      mx="auto"
      mt="3.5rem"
      mb="1.5rem"
      boxShadow="rgb(0 0 0 / 8%) 0rem 0.37rem 0.62rem"
      borderRadius="1.37rem"
    >
      <TokenModal
        isOpen={isOpen}
        onClose={onClose} // These are messy, consolidate into an object later

        selectedToken={
          activatedIsTokenModal.current === true ? tokenIn : tokenOut
        }
        otherToken={
          activatedIsTokenModal.current === true ? tokenOut : tokenIn
        }
        setSelectedToken={
         activatedIsTokenModal.current === true
            ? (token: Token) => {
                setTokenInQuantity(BigInt(0));
                setTokenIn(token);
              }
            : setTokenOut
        }
      />

      <Flex
        alignItems="center"
        p="1rem 1.25rem 0rem"
        bg={colorMode === "dark" ? "#1e1e1e" : "white"}
        justifyContent="space-between"
        borderRadius="1.37rem 1.37rem 0 0"
      >
        <Text color={colorMode === "dark" ? "white" : "black"} fontWeight="500">
          Swap from:
        </Text>
        <SettingsIcon
          fontSize="1.25rem"
          cursor="pointer"
          _hover={{ color: "rgb(128,128,128)" }}
        />
      </Flex>

      <Box
        p="0.5rem"
        bg={colorMode === "dark" ? "#1e1e1e" : "white"}
        borderRadius="0 0 1.37rem 1.37rem"
      >
        <Flex
          alignItems="center"
          justifyContent="space-between"
          bg={colorMode === "dark" ? "rgb(41,41,41)" : "rgb(247, 248, 250)"}
          p="1rem 1rem 1.7rem"
          borderRadius="1.25rem"
          border="0.06rem solid rgb(237, 238, 242)"
          _hover={{ border: "0.06rem solid rgb(211,211,211)" }}
        >
          <Box>
            <TokenSelect
              /*image={window.__imageSelected}*/ openTokenModal={onOpen}
              token={tokenIn}
              setActivatedButton={() =>
                (activatedIsTokenModal.current = true)
              }
              disabled={disabled}
            />
          </Box>
          <Box>
            <Text
              // mt="1rem"
              width="100%"
              size="5rem"
              textAlign="right"
              bg={colorMode === "dark" ? "rgb(41,41,41)" : "rgb(247, 248, 250)"}
              color={colorMode === "dark" ? "rgb(180,180,180)" : "gray"}
              fontSize="xs"
            >
              {tokenInBalance !== undefined &&
                `Balance: ${readableTokenINBalance} ${tokenIn?.symbol}`}
            </Text>
            <HStack spacing={1} mt="2rem" ml="-1.25rem">
              <Input
                placeholder="0.0"
                fontWeight="500"
                fontSize={isScreenFullWidth ? "1.5rem" : "1.25rem"}
                width="100%"
                size="19rem"
                textAlign="right"
                outline="none"
                border="none"
                focusBorderColor="none"
                type="number"
                color={colorMode === "dark" ? "white" : "black"}
                value={readableTokenInQuantity}
                onChange={async function (e) {
                  if (e.target.value !== undefined && tokenIn !== null) {
                    setTokenInQuantity(
                      BigInt(10 ** Math.max(0, tokenIn.decimals - 10)) *
                        BigInt(
                          Math.floor(
                            Number(e.target.value) *
                              10 ** Math.min(tokenIn.decimals, 10)
                          )
                        )
                    );
                  } else {
                    console.log(
                      "tokenIn quantity is undefined or tokenIn is null"
                    );
                  }
                }}
                disabled={disabled}
              />
              {tokenInQuantity !== tokenInBalance && (
                <Button
                  onClick={() => {
                    if (tokenInBalance) {
                      setTokenInQuantity(tokenInBalance);
                    }
                  }}
                >
                  MAX
                </Button>
              )}
            </HStack>
          </Box>
        </Flex>
        <Flex
          alignItems="center"
          justifyContent="center"
          bg={colorMode === "dark" ? "#1e1e1e" : "white"}
          p="0.4rem"
          borderRadius="0.75rem"
          pos="relative"
          top="0rem"
        >
          <Text
            color={colorMode === "dark" ? "white" : "black"}
            fontWeight="500"
            position={"absolute"}
            left={"0.77rem"}
            top={"0.6rem"}
          >
            Swap to:
          </Text>
          <ArrowDownIcon
                  bg={colorMode === "dark" ? "rgb(41,41,41)" : "rgb(247, 248, 250)"}
                  color="rgb(128,128,128)"
                  // position={"absolute"}
                  top={"0rem"}
                  h="1.5rem"
                  width="1.62rem"
                  borderRadius="0.75rem"
                  onClick={() => {
                    let token: Token | null = tokenIn;
                    let tokenAmt = tokenInQuantity;
                    
                    setTokenIn(tokenOut)
                    setTokenOut(token)
                    
                    console.log("tokenAmt: ", tokenAmt)
                    console.log("estimatedQuote: ", estimatedQuote)
                  }}
            />

        </Flex>
        <Flex
          alignItems="center"
          justifyContent="space-between"
          bg={colorMode === "dark" ? "rgb(41,41,41)" : "rgb(247, 248, 250)"}
          pos="relative"
          p="1rem 1rem 1.7rem"
          borderRadius="1.25rem"
          mt="0.25rem"
          border="0.06rem solid rgb(237, 238, 242)"
          _hover={{ border: "0.06rem solid rgb(211,211,211)" }}
        >
          <Box>
            <TokenSelect
              /*image={window.__imageSelected2}*/ openTokenModal={onOpen}
              token={tokenOut}
              setActivatedButton={() =>
                (activatedIsTokenModal.current = false)
              }
              disabled={disabled}
            />
          </Box>
          <Box>
            <Text
              // mt="1rem"
              width="100%"
              size="5rem"
              textAlign="right"
              bg={colorMode === "dark" ? "rgb(41,41,41)" : "rgb(247, 248, 250)"}
              color={colorMode === "dark" ? "rgb(180,180,180)" : "gray"}
              fontSize="xs"
            >
              {tokenOutBalance !== undefined &&
                `Balance: ${readableTokenBalance} ${tokenOut?.symbol}`}
            </Text>
            <Input
              mt="2rem"
              placeholder="0.0"
              fontSize={isScreenFullWidth ? "1.5rem" : "1.25rem"}
              width="100%"
              size="19rem"
              textAlign="right"
              outline="none"
              border="none"
              focusBorderColor="none"
              type="number"
              color={colorMode === "dark" ? "white" : "black"}
              readOnly={true}
              value={estimatedQuote.toFixed(4)}
            />
          </Box>
        </Flex>
       
        {tokenIn && tokenOut && (
          <Box color={colorMode === "dark" ? "white" : "black"}>
            1 {tokenIn.symbol} = {quotedExchangeRate.toFixed(4)}{" "}
            {tokenOut.symbol}
          </Box>
        )}
        <SwapButton
          tokenIn={tokenIn}
          areTokensSelected={tokenIn !== null && tokenOut !== null}
          isNonZeroQuantity={tokenInQuantity != BigInt(0)}
          isErc20GasPayable={isErc20GasPayable}
          userHasSufficientBalance={userHasSufficientBalance}
          userHasSufficcientAllowance={userHasSufficcientAllowance}
          startSwap={startSwap}
          approveToken={approveToken}
          disabled={disabled}
          isCA={isCA}
        />
         { isCA && tokenIn && (
           <VStack
             align="left"
             spacing={0.1}
             fontSize={14} 
             py={2} 
             pl={2}
             borderColor="black"
             borderRadius="3"
             >
            <Box color={colorMode === "dark" ? "white" : "black"} fontSize={16} >
              --- Account Trade Limit ---
              { !isAssetWhitelisted ? <Text color ="red" fontSize={13}>[INVALID TOKEN] Unfortunately, the input token isn't whitelisted.</Text> : null}
              </Box>
              <Box color={colorMode === "dark" ? "white" : "black"}>
              - Max Size Per Trade: {maxTradeAmountUSD ? (maxTradeAmountUSD / 1e18).toFixed(0) : 0}$
               { hasExceedMaxTradeSize ? <Text color ="red" fontSize={13}>[EXCEEDS MAX SIZE] Swap would fail. Please lower the amount.</Text> : null}
              </Box>
            <Box color={colorMode === "dark" ? "white" : "black"}>
              - Daily Trade Limit: {dailyTradeLimit ? (dailyTradeLimit / 1e18).toFixed(0) : 0}$
              </Box>
            <Box color={colorMode === "dark" ? "white" : "black"}>
              {console.log("estimatedAvailableAmount: ", estimatedAvailableAmount)}
              {console.log("hasSufficientLimit: ", hasSufficientLimit)}
              
              - Available Amount: {availabileAmount ? (Number(availabileAmount) / 1e18).toFixed(0): null }$
              {" "} 
              { estimatedAvailableAmount && hasSufficientLimit 
              ?  estimatedAvailableAmount > 0 && tokenInQuantity 
              ? `--> est. ${(estimatedAvailableAmount.toFixed(0))}$`   
              : <Text color ="red" fontSize={13}>[EXCEEDS DAILY LIMIT] Swap would fail. Please lower the amount.</Text>
              : null 
              }
               </Box>
           </VStack>
          )}
      </Box>
    </Box>
  );
}
