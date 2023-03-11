import { Button, Box, Text, VStack } from "@chakra-ui/react";
import { useEthers } from "@usedapp/core";
import { ZkSyncLocal } from "../common/zkSyncLocal";
import { Token } from "../common/Token";
import { grayed_lavender, lavender, turquoise } from "../theme";

type Props = {
  tokenIn: Token | null;
  areTokensSelected: boolean;
  isNonZeroQuantity: boolean;
  isErc20GasPayable: boolean;
  userHasSufficientBalance: boolean;
  userHasSufficcientAllowance: boolean;
  startSwap: any;
  approveToken: any;
  disabled: boolean;
  isCA: boolean;
};

export default function SwapButton({
  tokenIn,
  areTokensSelected,
  isNonZeroQuantity,
  isErc20GasPayable,
  userHasSufficientBalance,
  userHasSufficcientAllowance,
  startSwap,
  approveToken,
  disabled,
  isCA
}: Props) {
  const { account, chainId, switchNetwork, activateBrowserWallet, error } =
    useEthers();

  function funcIsCorrectChainId() {
      return chainId === ZkSyncLocal.chainId;
  }
  
  const isCorrectChainId = funcIsCorrectChainId();

  async function handleConnectWallet() {
    activateBrowserWallet({ type: "metamask" });
    await switchNetwork(ZkSyncLocal.chainId);
  }

  return account && isCorrectChainId ? (
    areTokensSelected && userHasSufficientBalance && isNonZeroQuantity ? (
      userHasSufficcientAllowance || isCA ? ( 
        isErc20GasPayable && isCA ? (
          <Box mt="0.5rem">
          <Button
            onClick={() => {
              startSwap();
            }}
            color="white"
            bg={lavender}
            width="100%"
            p="2.2rem"
            borderRadius="1.25rem"
            _hover={{ bg: turquoise }} // "rgb(147,196,125)"
            disabled={disabled}
          >
            <VStack spacing={2}>
            Swap
            <Text fontSize={20}> Swap </Text> 
            <Text pb={1} fontSize={15}> ( Gas fee paid in {tokenIn?.symbol} ) </Text> 
            </VStack>
            
            
          </Button>
        </Box>
        ) : (
          <Box mt="0.5rem">
          <Button
            onClick={() => {
              startSwap();
            }}
            color="white"
            bg={lavender}
            width="100%"
            p="1.62rem"
            borderRadius="1.25rem"
            _hover={{ bg: turquoise }}
            disabled={disabled}
          >
            Swap
          </Button>
        </Box>
        )
      ) : (
        <Box mt="0.5rem">
        <Button
          onClick={() => {
            approveToken();
          }}
          color="white"
          bg={lavender}
          width="100%"
          p="1.62rem"
          borderRadius="1.25rem"
          _hover={{ bg: turquoise }}
          disabled={disabled}
        >
          Approve {`${tokenIn?.symbol}`}
        </Button>
      </Box>
      )
    ) : (
      <Box mt="0.5rem">
        <Button
          color="white"
          bg={grayed_lavender}
          width="100%"
          p="1.62rem"
          borderRadius="1.25rem"
          _hover={{ bg: grayed_lavender }}
          disabled={disabled}
        >
          {areTokensSelected
           ? isNonZeroQuantity
              ? `Insufficient ${tokenIn?.symbol} balance`
             : `Amount can't be zero`
            : "Please select a token"}
        </Button>
      </Box>
    )
  ) : (
    <Box mt="0.5rem">
      <Button
        onClick={handleConnectWallet}
        color="white"
        bg={lavender}
        width="100%"
        p="1.62rem"
        borderRadius="1.25rem"
        _hover={{ bg: turquoise }}
        disabled={disabled}
      >
        {account === undefined
          ? "Connect Wallet"
          : "Switch network to zkSync Local"}
      </Button>
    </Box>
  );
}

