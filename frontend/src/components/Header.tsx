import { ReactNode, useEffect, useState } from "react";
import {
  Flex,
  Menu,
  Image,
  useColorMode,
  VStack,
  HStack,
  useDisclosure,
  Switch,
  Spacer,
  useMediaQuery,
} from "@chakra-ui/react";

import logo from "../assets/logo.svg";
import AccountModal from "./Modal/AccountModal";
import { SocialIcon } from "react-social-icons";
import ConnectButton from "./ConnectButton";

type Props = {
  children?: ReactNode;
};

export default function Layout({ children }: Props) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { colorMode, toggleColorMode } = useColorMode();
  const [isDarkMode, setIsDarkMode] = useState(colorMode === "dark");
  const [isScreenFullWidth] = useMediaQuery("(min-width: 435px)");
  const [isScreenMediumWidth] = useMediaQuery("(min-width: 400px)");
  const [isScreenSmallWidth] = useMediaQuery("(min-width: 380px)");

  function getFontSize() {
    return isScreenFullWidth ? "md" : "sm";
  }

  function getIconStyle() {
    return isScreenFullWidth
      ? { height: 35, width: 35 }
      : { height: 30, width: 30 };
  }

  function getLogoSize() {
    if (isScreenFullWidth) {
      return "8rem";
    } else if (isScreenMediumWidth) {
      return "7rem";
    } else if (isScreenSmallWidth) {
      return "6rem";
    }
    return "5rem";
  }

  useEffect(() => setIsDarkMode(colorMode === "dark"), [colorMode]);

  return (
    <Menu>
      <Flex alignItems="center" mx="1.5rem" mt="1.5rem">
        <Image boxSize={getLogoSize()} src={logo} alt="Nongaswap" />
        <Spacer />
        <VStack spacing={4}>
          <Switch
            colorScheme="purple"
            onChange={toggleColorMode}
            isChecked={isDarkMode}
            fontSize={getFontSize()}
            fontWeight="500"
            color={isDarkMode ? "white" : "black"}
          >
            Switch to {isDarkMode ? "light" : "dark"} mode
          </Switch>
          <ConnectButton handleOpenModal={onOpen} fontSize={getFontSize()} />
          <HStack spacing={1}>
            <SocialIcon
              url="https://github.com/porco-rosso-j/zksync-nongaswap"
              target="_blank"
              fgColor="white"
              bgColor="black"
              // bgColor={useColorModeValue("black", "rgb(110,110,110)")}
              style={getIconStyle()}
            />
          </HStack>
        </VStack>

        <AccountModal isOpen={isOpen} onClose={onClose} />
      </Flex>
    </Menu>
  );
}
