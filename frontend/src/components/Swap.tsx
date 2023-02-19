import {
  Flex,
  Box,
  Image,
  Button,
  Input,
  useDisclosure,
  Stack,
  Text,
  useToast,
  useColorMode,
  HStack,
  useMediaQuery,
} from "@chakra-ui/react";

import { ethers } from 'ethers';
import { SettingsIcon, ChevronDownIcon, ArrowDownIcon } from "@chakra-ui/icons";
import SwapButton from "./SwapButton";
import TokenSelect from "./TokenSelect";
import TokenModal from "./Modal/TokenModal";
import { useEffect, useState, useRef } from "react";
// import {
//   PrivaDexAPI,
//   SimpleSwapStatus,
// } from "../phat_api/privadex_phat_contract_api";
import { Token } from "../data_models/Token";
import {
  useEthers,
  useSendTransaction,
  TransactionOptions,
  useContractFunction,
  ERC20Interface,
  useEtherBalance,
  useTokenBalance,
  useConfig,
  useTokenAllowance,
 // ZkSyncLocal
} from "@usedapp/core";

import { _quoteSwap, _swapETH, _swapToken} from "../common/usdDappMimic"
import {address} from "../common/address"

import { ZkSyncLocal } from "../common/zkSyncLocal";

import { Contract } from "@ethersproject/contracts";
import { BigNumber } from "ethers";

// Used to display to the user the status of their swap
class SwapStatusDisplayManager {
  timerId: number;
  summaryStr: string;
  numConfirmedSteps: number | null;

  constructor(timerId: number, summaryStr: string) {
    this.timerId = timerId;
    this.summaryStr = summaryStr;
    this.numConfirmedSteps = null;
  }
}

export default function Trade() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { account, chainId } = useEthers();
  const config = useConfig();
  const toast = useToast();
  const { colorMode } = useColorMode();

  const [estimatedQuote, setEstimatedQuote] = useState<number>(0);
  // const [tokenInUsd, setTokenInUsd] = useState<number>(0);
  // const [tokenOutUsd, setTokenOutUsd] = useState<number>(0);
  const [estimatedOneSrcTokenQuote, setEstimatedOneSrcTokenQuote] =
    useState<number>(0);
  const [tokenIn, setTokenIn] = useState<Token | null>(null);
  const [tokenOut, setTokenOut] = useState<Token | null>(null);
  const [disabled, setDisabled] = useState<boolean>(false);
  // const [approval, setApproval] = useState<BigInt>(BigInt(0))
  const [srcQuantity, setSrcQuantity] = useState<BigInt>(BigInt(0));

  const readableSrcQuantity =
    srcQuantity && tokenIn
      ? Number(
          srcQuantity.valueOf() /
            BigInt(10 ** Math.max(0, tokenIn.decimals - 10))
        ) /
        10 ** Math.min(tokenIn.decimals, 10)
      : 0;

  const isNativeTokenIn =
  tokenIn?.getAddressFromEncodedTokenName() === "native";

  const isNativeTokenOut =
  tokenOut?.getAddressFromEncodedTokenName() === "native";
  
  const etherBalance = useEtherBalance(account);

  const tokenInAllowance = useTokenAllowance(
    isNativeTokenIn === false 
        ? tokenIn?.getAddressFromEncodedTokenName() : undefined,
        account as string,
        address.router
  )

  const userHasSufficcientAllowance = tokenInAllowance && BigNumber.from(0)
  ? tokenInAllowance?.toBigInt() >= srcQuantity
  : isNativeTokenIn === false
  ? false
  : true
  ;

  const tokenInErc20Balance: BigNumber | undefined = useTokenBalance(
    isNativeTokenIn === false
      ? tokenIn?.getAddressFromEncodedTokenName()
      : undefined,
    account
  );

  const tokenInBalance = 
  isNativeTokenIn === false
      ? tokenInErc20Balance?.toBigInt()
      : chainId === ZkSyncLocal.chainId
      ? etherBalance?.toBigInt()
      : undefined;

  const readableSrcTokenBalance = tokenInBalance
    ? Number(tokenInBalance / BigInt(10 ** (tokenIn?.decimals - 4))) / 10000
    : 0;

  const userHasSufficientBalance =
    tokenIn && tokenInBalance ? tokenInBalance >= srcQuantity : false;
    
  const tokenOutErc20Balance: BigNumber | undefined = useTokenBalance(
    isNativeTokenOut === false
      ? tokenOut?.getAddressFromEncodedTokenName()
      : undefined,
    account
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

  // Used to update the user about the status of their swap. Should abstract into a different
  // file or class later
  // var execPlanUuidToSwapStatusDisplayManager: {
  //   [key: string]: SwapStatusDisplayManager;
  // } = {};

  const activatedIsTokenModal = useRef(true); // false means the Dest token's TokenModal is activated
  // const privadexApi = useRef(new PrivaDexAPI(null, null));

  // We use the unchecked signer to get the transaction hash immediately.
  // useDapp/core doesn't even let you interface with the response (instead it makes you
  // wait for the receipt, so we hack in a callback)
  // https://docs.ethers.org/v5/api/providers/jsonrpc-provider/#UncheckedJsonRpcSigner
  // MetaMask apparently does not allow for signTransaction, only sendTransaction -
  // which is pretty frustrating
  const provider = config.connectors.metamask.provider;
  const signer = provider?.getSigner();

  // const delegateUncheckedSigner = provider?.getUncheckedSigner();

  // if (provider && signer && delegateUncheckedSigner) {
  //   signer.sendTransaction = async (txn) => {
  //     console.log("sendTransaction", txn, signer);
  //     let earlyResponse = await delegateUncheckedSigner.sendTransaction(txn);
  //     console.log("txn hash =", earlyResponse.hash);
  //     await kickOffPhatContract(earlyResponse.hash);
  //     console.log("Kicked off Phat Contract");
  //     setDisabled(false);
  //     return earlyResponse;
  //   };
  // }

  const txnOpts: TransactionOptions | undefined = signer
    ? { signer: signer }
    : undefined;
  // console.log("Txn opts:", txnOpts);

  const { sendTransaction, state: ethSendState } = useSendTransaction(txnOpts);

  const erc20Contract: any =
    tokenIn && tokenIn.getAddressFromEncodedTokenName() !== "native"
      ? (new Contract(
          tokenIn.getAddressFromEncodedTokenName(),
          ERC20Interface
        ) as any)
      : null;
  // console.log('tokenIn ERC20 contract', erc20Contract);
  // 
  // ----- Interactions ------ //
  // 

//   async function kickOffPhatContract(userToEscrowTxnHash: string) {
//     let execPlanUuid = await privadexApi.current.startSwap(
//       userToEscrowTxnHash,
//       //chain,
//       account,
//       account, // TODO: need to let the user specify this
//       tokenIn!.tokenNameEncoded,
//       tokenOut!.tokenNameEncoded,
//       srcQuantity
//     );
//     let summaryStr = `${tokenIn!.symbol} -> ${
//       tokenOut!.symbol
//     } swap`;
//     let timerId = setInterval(updateSwapStatus, 5000, execPlanUuid);
//     execPlanUuidToSwapStatusDisplayManager[execPlanUuid] =
//       new SwapStatusDisplayManager(timerId, summaryStr);
//  }

  // async function updateSwapStatus(execPlanUuid: string) {
  //   let timerId = execPlanUuidToSwapStatusDisplayManager[execPlanUuid].timerId;
  //   if (timerId !== null) {
  //     let execPlanStatus = await privadexApi.current.getStatus(execPlanUuid);
  //     if (
  //       execPlanUuidToSwapStatusDisplayManager[execPlanUuid]
  //         .numConfirmedSteps === execPlanStatus.numConfirmedSteps ||
  //       execPlanStatus.simpleStatus === SimpleSwapStatus.Unknown
  //     ) {
  //       // Only toast on new meaningful state update
  //       return;
  //     }
  //     execPlanUuidToSwapStatusDisplayManager[execPlanUuid].numConfirmedSteps =
  //       execPlanStatus.numConfirmedSteps;
  //     console.log("Swap status = ", execPlanStatus);
  //     let execSummary =
  //       execPlanUuidToSwapStatusDisplayManager[execPlanUuid].summaryStr;
  //     if (execPlanStatus.simpleStatus === SimpleSwapStatus.Confirmed) {
  //       toast({
  //         title: "Swap completed!",
  //         description: `Your ${execSummary} is confirmed.`,
  //         status: "success",
  //         duration: 16000,
  //         isClosable: true,
  //         position: "top-right",
  //       });
  //       clearInterval(timerId);
  //       delete execPlanUuidToSwapStatusDisplayManager[execPlanUuid];
  //     } else if (execPlanStatus.simpleStatus === SimpleSwapStatus.InProgress) {
  //       let description =
  //         execPlanStatus.numConfirmedSteps > 0
  //           ? `${execPlanStatus.numConfirmedSteps} of ${execPlanStatus.totalSteps} ` +
  //             `steps completed for your ${execSummary}.`
  //           : `Your ${execSummary} has begun (${execPlanStatus.totalSteps} steps remaining)`;
  //       toast({
  //         title: "Swap in progress...",
  //         description: description,
  //         status: "info",
  //         duration: 16000,
  //         isClosable: true,
  //         position: "top-right",
  //       });
  //     } else if (execPlanStatus.simpleStatus === SimpleSwapStatus.Failed) {
  //       toast({
  //         title: "Swap failed :(",
  //         description:
  //           `Your ${execSummary} failed due to high slippage. ` +
  //           "Please contact us (via Discord or the feedback form) and copy-paste the following ID: " +
  //           `${execPlanUuid}. We will revert your funds back to you.`,
  //         status: "error",
  //         duration: null,
  //         isClosable: true,
  //         position: "top-right",
  //       });
  //       clearInterval(timerId);
  //       delete execPlanUuidToSwapStatusDisplayManager[execPlanUuid];
  //     }
  //   }
  // }

  const { send, state: erc20State } = useContractFunction(
    erc20Contract,
    "approve",
    txnOpts
  );

  async function approveToken() {
    send(address.router, ethers.constants.MaxUint256)
  }

  async function startSwap() {
    // Assume that the caller has performed the necessary checks
    // (tokenIn and tokenOut are set, we are on chain, and srcQuantity > 0)
    // let escrowAddress = await privadexApi.current.escrowEthAddress();
    let tokenInAddress = tokenIn!.getAddressFromEncodedTokenName();
    let tokenOutAddress = tokenOut!.getAddressFromEncodedTokenName();
    //let amountIn = srcQuantity;
    let receipt;
    let tx;

    console.log("tokenInAddress:", tokenInAddress)
    console.log("tokenOutAddress:", tokenOutAddress)


    setDisabled(true);
    if (tokenInAddress === "native") {
      tx = await _swapETH(
        tokenOutAddress, 
        srcQuantity,
        account
        )

      receipt = await sendTransaction(tx)

    } else if (tokenOutAddress == "native") {
      // need approval
      tx = await _swapToken(
        tokenInAddress,
        srcQuantity,
        account
        )
      receipt = await sendTransaction(tx)
    }
    console.log("swap transaction receipt =", receipt);
    setDisabled(false);
  }

  // useEffect(() => {
  //   async function initializePrivaDexApi() {
  //     privadexApi.current = await PrivaDexAPI.initialize();
  //   }
  //   initializePrivaDexApi();
  // }, []);

  useEffect(() => {
    console.log("tokenInAllowance:", tokenInAllowance);
    const timeOutId = setTimeout(async () => {
      if (tokenIn && tokenOut && srcQuantity > BigInt(0)) {
        let rawQuote = await _quoteSwap(
          tokenIn?.getAddressFromEncodedTokenName(),
          tokenOut?.getAddressFromEncodedTokenName(),
          srcQuantity
        );
        let quote = Number(rawQuote) / 10 ** tokenOut.decimals;
  
        setEstimatedQuote(quote);
      }
    }, 300);
    return () => clearTimeout(timeOutId);
  }, [srcQuantity, tokenIn, tokenOut]);

  useEffect(() => {
    const timeOutId = setTimeout(async () => {
      if (tokenIn && tokenOut) {
        let rawQuote = await _quoteSwap(
          tokenIn?.getAddressFromEncodedTokenName(),
          tokenOut?.getAddressFromEncodedTokenName(),
          BigInt(10 ** tokenIn.decimals)
        );
        let quote = Number(rawQuote) / 10 ** tokenOut.decimals;
        setEstimatedOneSrcTokenQuote(quote);
      }
    }, 300);
    return () => clearTimeout(timeOutId);
}, [tokenIn, tokenOut]);

  // 
  // ----- Interactions ------ //
  // 

  const [isScreenSmallWidth] = useMediaQuery("(max-width: 325px)");
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
                setSrcQuantity(BigInt(0));
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
        {/* <SettingsIcon
          fontSize="1.25rem"
          cursor="pointer"
          _hover={{ color: "rgb(128,128,128)" }}
        /> */}
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
                `Balance: ${readableSrcTokenBalance} ${tokenIn?.symbol}`}
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
                value={readableSrcQuantity}
                onChange={async function (e) {
                  if (e.target.value !== undefined && tokenIn !== null) {
                    setSrcQuantity(
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
                      "src quantity is undefined or src token is null"
                    );
                  }
                }}
                disabled={disabled}
              />
              {console.log("srcQuantity: ", srcQuantity)}
              {console.log("userHasSufficcientAllowance: ", userHasSufficcientAllowance)}
              {/* {console.log("etherBalance:", etherBalance)}
              {console.log("account:", account)} */}
              {srcQuantity !== tokenInBalance && (
                <Button
                  onClick={() => {
                    if (tokenInBalance) {
                      setSrcQuantity(tokenInBalance);
                    }
                  }}
                >
                  MAX
                </Button>
              )}
            </HStack>
            {/* <Text
              mt="1rem"
              width="100%"
              textAlign="right"
              bg={colorMode === "dark" ? "rgb(41,41,41)" : "rgb(247, 248, 250)"}
              color={colorMode === "dark" ? "rgb(180,180,180)" : "gray"}
              fontSize="s"
            >
              ${tokenInUsd.toFixed(4)}
            </Text> */}
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
            {/* <Text
              mt="1rem"
              width="100%"
              textAlign="right"
              bg={colorMode === "dark" ? "rgb(41,41,41)" : "rgb(247, 248, 250)"}
              color={colorMode === "dark" ? "rgb(180,180,180)" : "gray"}
              fontSize="s"
            >
              ${tokenOutUsd.toFixed(4)}
            </Text> */}
          </Box>
        </Flex>
        {tokenIn && tokenOut && (
          <Box color={colorMode === "dark" ? "white" : "black"}>
            1 {tokenIn.symbol} = {estimatedOneSrcTokenQuote.toFixed(4)}{" "}
            {tokenOut.symbol}
          </Box>
        )}
        <SwapButton
          tokenIn={tokenIn}
          areTokensSelected={tokenIn !== null && tokenOut !== null}
          // areQuantitiesHighEnough={tokenOutUsd >= 0}
          userHasSufficientBalance={userHasSufficientBalance}
          userHasSufficcientAllowance={userHasSufficcientAllowance}
          startSwap={startSwap}
          approveToken={approveToken}
          disabled={disabled}
        />
      </Box>
    </Box>
  );
}
