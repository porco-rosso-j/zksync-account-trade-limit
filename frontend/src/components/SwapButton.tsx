import { Button, Box } from "@chakra-ui/react";
import { useConnector, useEthers } from "@usedapp/core";
import { ZkSyncLocal } from "../common/zkSyncLocal";
import { Token } from "../data_models/Token";
import { grayed_lavender, lavender, turquoise } from "../theme";

type Props = {
  tokenIn: Token | null;
  areTokensSelected: boolean;
  isNonZeroQuantity: boolean;
  userHasSufficientBalance: boolean;
  userHasSufficcientAllowance: boolean;
  startSwap: any;
  approveToken: any;
  disabled: boolean;
};

export default function SwapButton({
  tokenIn,
  areTokensSelected,
  isNonZeroQuantity,
  userHasSufficientBalance,
  userHasSufficcientAllowance,
  startSwap,
  approveToken,
  disabled,
}: Props) {
  const { account, chainId, switchNetwork, activateBrowserWallet, error } =
    useEthers();
  const { connector, isLoading } = useConnector();

  function funcIsCorrectChainId() {
      return chainId === ZkSyncLocal.chainId;
  }

  const isCorrectChainId = funcIsCorrectChainId();

  async function handleConnectWallet() {
    activateBrowserWallet({ type: "metamask" });
    await switchNetwork(ZkSyncLocal.chainId);
  }

  return account && isCorrectChainId ? (
    // areTokensSelected && areQuantitiesHighEnough && hasSufficientApproval ? (
    areTokensSelected && userHasSufficientBalance && isNonZeroQuantity ? (

      userHasSufficcientAllowance ? ( 
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
          //  ? hasSufficientApproval
              ? `Insufficient ${tokenIn?.symbol} balance`
          //    : "Insufficient Approval"
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

