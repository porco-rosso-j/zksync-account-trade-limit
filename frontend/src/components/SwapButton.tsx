import { Button, Box } from "@chakra-ui/react";
import { useConnector, useEthers, ZkSyncTestnet } from "@usedapp/core";
import { Token } from "../data_models/Token";
import { grayed_lavender, lavender, turquoise } from "../theme";

type Props = {
  srcChain: string;
  srcToken: Token | null;
  areTokensSelected: boolean;
  areQuantitiesHighEnough: boolean;
  userHasSufficientBalance: boolean;
  startSwap: any;
  disabled: boolean;
};

export default function SwapButton({
  srcChain,
  srcToken,
  areTokensSelected,
  areQuantitiesHighEnough,
  userHasSufficientBalance,
  startSwap,
  disabled,
}: Props) {
  const { account, chainId, switchNetwork, activateBrowserWallet, error } =
    useEthers();
  const { connector, isLoading } = useConnector();

  function funcIsCorrectChainId() {
    // Should make Chain not a string later so I don't have to do this if-else logic here
    if (srcChain === "zksync") {
      return chainId === ZkSyncTestnet.chainId;
    }
    return false;
  }

  const isCorrectChainId = funcIsCorrectChainId();

  async function handleConnectWallet() {
    activateBrowserWallet({ type: "metamask" });
    if (srcChain === "zksync") {
      await switchNetwork(ZkSyncTestnet.chainId);
    }
  }

  return account && isCorrectChainId ? (
    areTokensSelected && areQuantitiesHighEnough && userHasSufficientBalance ? (
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
          color="white"
          bg={grayed_lavender}
          width="100%"
          p="1.62rem"
          borderRadius="1.25rem"
          _hover={{ bg: grayed_lavender }}
          disabled={disabled}
        >
          {areTokensSelected
            ? areQuantitiesHighEnough
              ? `Insufficient ${srcToken?.symbol} balance`
              : "Amount too low"
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
          : `Switch network to ${srcChain
              .charAt(0)
              .toUpperCase()}${srcChain.slice(1)}`}
      </Button>
    </Box>
  );
}
