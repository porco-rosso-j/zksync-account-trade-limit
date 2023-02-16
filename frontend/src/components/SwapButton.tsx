import { Button, Box } from "@chakra-ui/react";
import { useConnector, useEthers, ZkSyncTestnet } from "@usedapp/core";
import { Token } from "../data_models/Token";
import { grayed_lavender, lavender, turquoise } from "../theme";

type Props = {
  tokenIn: Token | null;
  areTokensSelected: boolean;
  areQuantitiesHighEnough: boolean;
  userHasSufficientBalance: boolean;
  startSwap: any;
  disabled: boolean;
};

export default function SwapButton({
  tokenIn,
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
      return chainId === ZkSyncTestnet.chainId;

  }

  const isCorrectChainId = funcIsCorrectChainId();

  async function handleConnectWallet() {
    activateBrowserWallet({ type: "metamask" });
    await switchNetwork(ZkSyncTestnet.chainId);
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
              ? `Insufficient ${tokenIn?.symbol} balance`
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
          : "Switch network to zkSync"}
      </Button>
    </Box>
  );
}

