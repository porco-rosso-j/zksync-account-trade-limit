import { Button, Box, Text, Flex, useColorMode } from "@chakra-ui/react";
import { useEthers, useEtherBalance } from "@usedapp/core";
import { formatEther } from "@ethersproject/units";
import Identicon from "./Identicon";

type Props = {
  handleOpenModal: any;
  fontSize: string;
  CAAddress: string;
  isCA: boolean
};

export default function ConnectButton({ handleOpenModal, fontSize, CAAddress, isCA }: Props) {
  const { activateBrowserWallet, account } = useEthers();
  const etherBalance = useEtherBalance((isCA ? CAAddress: account));
  const {colorMode } = useColorMode();

  function handleConnectWallet() {
    activateBrowserWallet();
  }

  return account ? (
    <Flex alignItems="center" bg={colorMode === "dark" ? "rgb(30,30,30)" : "rgb(247, 248, 250)"} borderRadius="xl" py="0" mx="1.5rem">
      <Box px="3">
        <Text color={colorMode === "dark" ? "white" : "black"} fontSize={fontSize}>
          {console.log("ethbalance!: ", etherBalance)}
          {etherBalance && parseFloat(formatEther(etherBalance)).toFixed(0)} ETH
        </Text>
      </Box>
      <Button
        onClick={handleOpenModal}
        bg={colorMode === "dark" ? "black" : "white"}
        border="0.06rem solid transparent"
        _hover={{
          border: "0.06rem",
          borderStyle: "solid",
          borderColor: "rgb(211,211,211)",
        }}
        borderRadius="xl"
        m="0.06rem"
        px={3}
        h="2.37rem"
      >
        {isCA ? (
        <Text color={colorMode === "dark" ? "white" : "black"} fontSize={fontSize} fontWeight="medium" mr="2">
        {CAAddress &&
          `${CAAddress.slice(0, 6)}...${CAAddress.slice(
            CAAddress.length - 4,
            CAAddress.length
          )}`}
      </Text>
        ) 
        : (
        <Text color={colorMode === "dark" ? "white" : "black"} fontSize={fontSize} fontWeight="medium" mr="2">
          {account &&
            `${account.slice(0, 6)}...${account.slice(
              account.length - 4,
              account.length
            )}`}
        </Text>
        )}
        <Identicon />
      </Button>
    </Flex>
  ) : (
    <Button
      onClick={handleConnectWallet}
      bg="rgb(253, 234, 241)"
      color="rgb(213, 0, 102)"
      fontSize={fontSize}
      fontWeight="semibold"
      borderRadius="xl"
      border="0.06rem solid rgb(253, 234, 241)"
      _hover={{
        borderColor: "rgb(213, 0, 102)",
      }}
      _active={{
        borderColor: "rgb(213, 0, 102)",
      }}
    >
      Connect to a wallet
    </Button>
  );
}
