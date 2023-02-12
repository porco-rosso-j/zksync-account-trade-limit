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

import { SettingsIcon, ChevronDownIcon, ArrowDownIcon } from "@chakra-ui/icons";
import SwapButton from "./SwapButton";
import TokenSelect from "./TokenSelect";
import TokenModal from "./Modal/TokenModal";
import { useEffect, useState, useRef } from "react";
import {
  PrivaDexAPI,
  SimpleSwapStatus,
} from "../phat_api/privadex_phat_contract_api";
import { Token } from "../data_models/Token";
import {
  useEthers,
  useSendTransaction,
  TransactionOptions,
  useContractFunction,
  ERC20Interface,
  useEtherBalance,
  useTokenBalance,
  ZkSyncTestnet,
} from "@usedapp/core";
import { useConfig } from "@usedapp/core";
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
  const [srcUsd, setSrcUsd] = useState<number>(0);
  const [destUsd, setDestUsd] = useState<number>(0);
  const [estimatedOneSrcTokenQuote, setEstimatedOneSrcTokenQuote] =
    useState<number>(0);
  const [srcToken, setSrcToken] = useState<Token | null>(null);
  const [destToken, setDestToken] = useState<Token | null>(null);
  const [srcChain, setSrcChain] = useState<string>("zksync");
  const [destChain, setDestChain] = useState<string>("zksync");
  const [disabled, setDisabled] = useState<boolean>(false);

  const [srcQuantity, setSrcQuantity] = useState<BigInt>(BigInt(0));
  const readableSrcQuantity =
    srcQuantity && srcToken
      ? Number(
          srcQuantity.valueOf() /
            BigInt(10 ** Math.max(0, srcToken.decimals - 10))
        ) /
        10 ** Math.min(srcToken.decimals, 10)
      : 0;

  const isSrcTokenNative =
    srcToken?.getAddressFromEncodedTokenName() === "native";
  const etherBalance = useEtherBalance(account);
  const srcErc20Balance: BigNumber | undefined = useTokenBalance(
    isSrcTokenNative === false
      ? srcToken?.getAddressFromEncodedTokenName()
      : undefined,
    account
  );
  const srcTokenBalance =
    isSrcTokenNative === false
      ? srcErc20Balance?.toBigInt()
      : (chainId === ZkSyncTestnet.chainId && srcChain === "zksync") ||
        (chainId === ZkSyncTestnet.chainId && srcChain === "zksync")
      ? etherBalance?.toBigInt()
      : undefined;
  const readableSrcTokenBalance = srcTokenBalance
    ? Number(srcTokenBalance / BigInt(10 ** (srcToken?.decimals - 4))) / 10000
    : 0;
  const userHasSufficientBalance =
    srcToken && srcTokenBalance ? srcTokenBalance >= srcQuantity : false;

  const isDestTokenNative =
    destToken?.getAddressFromEncodedTokenName() === "native";
  const destErc20Balance: BigNumber | undefined = useTokenBalance(
    isDestTokenNative === false && srcChain === destChain
      ? destToken?.getAddressFromEncodedTokenName()
      : undefined,
    account
  );
  const destTokenBalance =
    isDestTokenNative === false
      ? destErc20Balance?.toBigInt()
      : (chainId === ZkSyncTestnet.chainId && destChain === "zksync") ||
        (chainId === ZkSyncTestnet.chainId && destChain === "zksync")
      ? etherBalance?.toBigInt()
      : undefined;
  const readableDestTokenBalance = destTokenBalance
    ? Number(destTokenBalance / BigInt(10 ** (destToken?.decimals - 4))) / 10000
    : 0;

  // Used to update the user about the status of their swap. Should abstract into a different
  // file or class later
  var execPlanUuidToSwapStatusDisplayManager: {
    [key: string]: SwapStatusDisplayManager;
  } = {};

  const activatedIsSrcTokenModal = useRef(true); // false means the Dest token's TokenModal is activated
  const privadexApi = useRef(new PrivaDexAPI(null, null));

  // We use the unchecked signer to get the transaction hash immediately.
  // useDapp/core doesn't even let you interface with the response (instead it makes you
  // wait for the receipt, so we hack in a callback)
  // https://docs.ethers.org/v5/api/providers/jsonrpc-provider/#UncheckedJsonRpcSigner
  // MetaMask apparently does not allow for signTransaction, only sendTransaction -
  // which is pretty frustrating
  const provider = config.connectors.metamask.provider;
  const signer = provider?.getSigner();
  const delegateUncheckedSigner = provider?.getUncheckedSigner();
  if (provider && signer && delegateUncheckedSigner) {
    signer.sendTransaction = async (txn) => {
      console.log("sendTransaction", txn, signer);
      let earlyResponse = await delegateUncheckedSigner.sendTransaction(txn);
      console.log("txn hash =", earlyResponse.hash);
      await kickOffPhatContract(earlyResponse.hash);
      console.log("Kicked off Phat Contract");
      setDisabled(false);
      return earlyResponse;
    };
  }
  const txnOpts: TransactionOptions | undefined = signer
    ? { signer: signer }
    : undefined;
  // console.log("Txn opts:", txnOpts);
  const { sendTransaction, state: ethSendState } = useSendTransaction(txnOpts);

  const erc20Contract: any =
    srcToken && srcToken.getAddressFromEncodedTokenName() !== "native"
      ? (new Contract(
          srcToken.getAddressFromEncodedTokenName(),
          ERC20Interface
        ) as any)
      : null;
  // console.log('srcToken ERC20 contract', erc20Contract);
  const { send, state: erc20State } = useContractFunction(
    erc20Contract,
    "transfer",
    txnOpts
  );

  async function kickOffPhatContract(userToEscrowTxnHash: string) {
    let execPlanUuid = await privadexApi.current.startSwap(
      userToEscrowTxnHash,
      srcChain,
      destChain,
      account,
      account, // TODO: need to let the user specify this
      srcToken!.tokenNameEncoded,
      destToken!.tokenNameEncoded,
      srcQuantity
    );
    let capSrcChain = srcChain.charAt(0).toUpperCase() + srcChain.slice(1);
    let capDestChain = destChain.charAt(0).toUpperCase() + destChain.slice(1);
    let summaryStr = `${srcToken!.symbol} (${capSrcChain}) -> ${
      destToken!.symbol
    } (${capDestChain}) swap`;
    let timerId = setInterval(updateSwapStatus, 5000, execPlanUuid);
    execPlanUuidToSwapStatusDisplayManager[execPlanUuid] =
      new SwapStatusDisplayManager(timerId, summaryStr);
  }

  async function updateSwapStatus(execPlanUuid: string) {
    let timerId = execPlanUuidToSwapStatusDisplayManager[execPlanUuid].timerId;
    if (timerId !== null) {
      let execPlanStatus = await privadexApi.current.getStatus(execPlanUuid);
      if (
        execPlanUuidToSwapStatusDisplayManager[execPlanUuid]
          .numConfirmedSteps === execPlanStatus.numConfirmedSteps ||
        execPlanStatus.simpleStatus === SimpleSwapStatus.Unknown
      ) {
        // Only toast on new meaningful state update
        return;
      }
      execPlanUuidToSwapStatusDisplayManager[execPlanUuid].numConfirmedSteps =
        execPlanStatus.numConfirmedSteps;
      console.log("Swap status = ", execPlanStatus);
      let execSummary =
        execPlanUuidToSwapStatusDisplayManager[execPlanUuid].summaryStr;
      if (execPlanStatus.simpleStatus === SimpleSwapStatus.Confirmed) {
        toast({
          title: "Swap completed!",
          description: `Your ${execSummary} is confirmed.`,
          status: "success",
          duration: 16000,
          isClosable: true,
          position: "top-right",
        });
        clearInterval(timerId);
        delete execPlanUuidToSwapStatusDisplayManager[execPlanUuid];
      } else if (execPlanStatus.simpleStatus === SimpleSwapStatus.InProgress) {
        let description =
          execPlanStatus.numConfirmedSteps > 0
            ? `${execPlanStatus.numConfirmedSteps} of ${execPlanStatus.totalSteps} ` +
              `steps completed for your ${execSummary}.`
            : `Your ${execSummary} has begun (${execPlanStatus.totalSteps} steps remaining)`;
        toast({
          title: "Swap in progress...",
          description: description,
          status: "info",
          duration: 16000,
          isClosable: true,
          position: "top-right",
        });
      } else if (execPlanStatus.simpleStatus === SimpleSwapStatus.Failed) {
        toast({
          title: "Swap failed :(",
          description:
            `Your ${execSummary} failed due to high slippage. ` +
            "Please contact us (via Discord or the feedback form) and copy-paste the following ID: " +
            `${execPlanUuid}. We will revert your funds back to you.`,
          status: "error",
          duration: null,
          isClosable: true,
          position: "top-right",
        });
        clearInterval(timerId);
        delete execPlanUuidToSwapStatusDisplayManager[execPlanUuid];
      }
    }
  }

  async function startSwap() {
    // Assume that the caller has performed the necessary checks
    // (srcToken and destToken are set, we are on srcChain, and srcQuantity > 0)
    let escrowAddress = await privadexApi.current.escrowEthAddress();
    let srcTokenAddress = srcToken!.getAddressFromEncodedTokenName();
    let amountIn = srcQuantity;
    let receipt;
    setDisabled(true);
    if (srcTokenAddress === "native") {
      receipt = await sendTransaction({
        to: escrowAddress,
        value: BigNumber.from(amountIn),
        gasLimit: BigNumber.from(21000),
      });
    } else {
      // For some reason, the gas fee estimate is 0 sometimes (I assume the gas
      // fee estimate in useDapp fails). I'm hard-coding 65,000 across the board
      // as a generous overestimate
      receipt = await send(escrowAddress, amountIn, {
        gasLimit: BigNumber.from(65000),
      });
    }
    console.log("User to escrow transaction receipt =", receipt);
    setDisabled(false);
  }

  useEffect(() => {
    async function initializePrivaDexApi() {
      privadexApi.current = await PrivaDexAPI.initialize();
    }
    initializePrivaDexApi();
  }, []);

  useEffect(() => {
    const timeOutId = setTimeout(async () => {
      if (srcToken && destToken && srcQuantity > BigInt(0)) {
        let [rawQuote, srcUsd, destUsd] = await privadexApi.current.quote(
          srcChain,
          destChain,
          srcToken.tokenNameEncoded,
          destToken.tokenNameEncoded,
          srcQuantity
        );
        let quote = Number(rawQuote) / 10 ** destToken.decimals;
        // console.log("quote =", quote);
        setEstimatedQuote(quote);
        setSrcUsd(srcUsd);
        setDestUsd(destUsd);
      }
    }, 300);
    return () => clearTimeout(timeOutId);
  }, [srcQuantity, srcToken, destToken, srcChain, destChain]);

  useEffect(() => {
    const timeOutId = setTimeout(async () => {
      if (srcToken && destToken) {
        let [rawQuote, _srcUsd, _destUsd] = await privadexApi.current.quote(
          srcChain,
          destChain,
          srcToken.tokenNameEncoded,
          destToken.tokenNameEncoded,
          BigInt(10 ** srcToken.decimals)
        );
        let quote = Number(rawQuote) / 10 ** destToken.decimals;
        setEstimatedOneSrcTokenQuote(quote);
      }
    }, 300);
    return () => clearTimeout(timeOutId);
  }, [srcToken, destToken, srcChain, destChain]);

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
        selectedChain={
          activatedIsSrcTokenModal.current === true ? srcChain : destChain
        }
        selectedToken={
          activatedIsSrcTokenModal.current === true ? srcToken : destToken
        }
        otherToken={
          activatedIsSrcTokenModal.current === true ? destToken : srcToken
        }
        setSelectedToken={
          activatedIsSrcTokenModal.current === true
            ? (token: Token) => {
                setSrcQuantity(BigInt(0));
                setSrcToken(token);
              }
            : setDestToken
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
              token={srcToken}
              setActivatedButton={() =>
                (activatedIsSrcTokenModal.current = true)
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
              {srcTokenBalance !== undefined &&
                `Balance: ${readableSrcTokenBalance} ${srcToken?.symbol}`}
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
                  if (e.target.value !== undefined && srcToken !== null) {
                    setSrcQuantity(
                      BigInt(10 ** Math.max(0, srcToken.decimals - 10)) *
                        BigInt(
                          Math.floor(
                            Number(e.target.value) *
                              10 ** Math.min(srcToken.decimals, 10)
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
              {srcQuantity !== srcTokenBalance && (
                <Button
                  onClick={() => {
                    if (srcTokenBalance) {
                      setSrcQuantity(srcTokenBalance);
                    }
                  }}
                >
                  MAX
                </Button>
              )}
            </HStack>
            <Text
              mt="1rem"
              width="100%"
              textAlign="right"
              bg={colorMode === "dark" ? "rgb(41,41,41)" : "rgb(247, 248, 250)"}
              color={colorMode === "dark" ? "rgb(180,180,180)" : "gray"}
              fontSize="s"
            >
              ${srcUsd.toFixed(4)}
            </Text>
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
              token={destToken}
              setActivatedButton={() =>
                (activatedIsSrcTokenModal.current = false)
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
              {destTokenBalance !== undefined &&
                `Balance: ${readableDestTokenBalance} ${destToken?.symbol}`}
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
            <Text
              mt="1rem"
              width="100%"
              textAlign="right"
              bg={colorMode === "dark" ? "rgb(41,41,41)" : "rgb(247, 248, 250)"}
              color={colorMode === "dark" ? "rgb(180,180,180)" : "gray"}
              fontSize="s"
            >
              ${destUsd.toFixed(4)}
            </Text>
          </Box>
        </Flex>
        {srcToken && destToken && (
          <Box color={colorMode === "dark" ? "white" : "black"}>
            1 {srcToken.symbol} = {estimatedOneSrcTokenQuote.toFixed(4)}{" "}
            {destToken.symbol}
          </Box>
        )}
        <SwapButton
          srcChain={srcChain}
          srcToken={srcToken}
          areTokensSelected={srcToken !== null && destToken !== null}
          areQuantitiesHighEnough={destUsd >= 0.1}
          userHasSufficientBalance={userHasSufficientBalance}
          startSwap={startSwap}
          disabled={disabled}
        />
      </Box>
    </Box>
  );
}
