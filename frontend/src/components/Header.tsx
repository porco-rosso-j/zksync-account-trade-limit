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
  Box
} from "@chakra-ui/react";

import logo from "../assets/logo.svg";
import AccountModal from "./Modal/AccountModal";
import { SocialIcon } from "react-social-icons";
import ConnectButton from "./ConnectButton";
// import TopNavBar from './NavBar'
// import { Outlet } from "react-router-dom";

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
        <Image boxSize={getLogoSize()} src={logo} alt="nongaswap logo" />
        <Spacer />
        <VStack spacing={4}>
          <Switch
            colorScheme="green"
            onChange={toggleColorMode}
            isChecked={isDarkMode}
            fontSize={getFontSize()}
            fontWeight="400"
            color={isDarkMode ? "white" : "black"}
          >
            Switch to {isDarkMode ? "light" : "dark"} mode
          </Switch>
          <ConnectButton handleOpenModal={onOpen} fontSize={getFontSize()} />

        </VStack>

        <AccountModal isOpen={isOpen} onClose={onClose} />
      </Flex>
    </Menu>
  );
}
