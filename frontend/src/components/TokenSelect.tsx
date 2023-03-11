import {Button, Box, Image, useDisclosure, useColorMode} from "@chakra-ui/react";
import {ChevronDownIcon} from "@chakra-ui/icons";
import { Token } from "../common/Token";
import { lavender, turquoise } from "../theme";

type Props = {
  openTokenModal: any;
  token: Token | null;
  setActivatedButton: any;
  disabled: boolean;
};

export default function TokenSelect({ openTokenModal, token, /*image,*/ setActivatedButton, disabled } : Props) {
  const { colorMode } = useColorMode();

  return token !== null ? (
    <Button
      bg={colorMode === "dark" ? "#1e1e1e" : "white"}
      borderRadius="1.12rem"
      boxShadow="rgba(0, 0, 0, 0.075) 0px 6px 10px"
      fontWeight="500"
      mr="0.5rem"
      color={colorMode === "dark" ? "white" : "black"}
      onClick={() => {
        setActivatedButton();
        openTokenModal();}}
      _hover={{ bg: turquoise }}
      rightIcon={<ChevronDownIcon fontSize="1.37rem" cursor="pointer" />}
      disabled={disabled}
      >
      {token!.symbol}
    </Button>
  ) : (
    <Button
      bg={lavender}
      color="white"
      p="0rem 1rem"
      borderRadius="1.12rem"
      onClick={() => {
        setActivatedButton();
        openTokenModal();}}
      _hover={{ bg: turquoise }}
      rightIcon={<ChevronDownIcon fontSize="1.37rem" cursor="pointer" />}
      disabled={disabled}>
        Select a token
    </Button>
  );
}
