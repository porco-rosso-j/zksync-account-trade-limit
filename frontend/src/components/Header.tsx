import { ReactNode, useEffect, useState } from "react";
import {
  Flex,
  Menu,
  Image,
  useColorMode,
  VStack,
  useDisclosure,
  Switch,
  Spacer,
  useMediaQuery
} from "@chakra-ui/react";

import logo from "../assets/logo@_adobe_express.svg";
import AccountModal from "./Modal/AccountModal";
import ConnectButton from "./ConnectButton";

type Props = {
  children?: ReactNode;
  CAAddress: string;
  setCAddress: any
  setIsCA: any
  isCA: any
};

// 
export default function Layout({ children, setCAddress, CAAddress, setIsCA, isCA }: Props) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { colorMode, toggleColorMode } = useColorMode();
  const [isDarkMode, setIsDarkMode] = useState(colorMode === "dark");
  const [isScreenFullWidth] = useMediaQuery("(min-width: 435px)");
  const [isScreenMediumWidth] = useMediaQuery("(min-width: 400px)");
  const [isScreenSmallWidth] = useMediaQuery("(min-width: 380px)");

  function getFontSize() {
    return isScreenFullWidth ? "md" : "sm";
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
        <Image boxSize={getLogoSize()} src={logo} alt="swap logo" />
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
          <ConnectButton handleOpenModal={onOpen} fontSize={getFontSize()} isCA={isCA} CAAddress={CAAddress} />

        </VStack>

        <AccountModal 
        isOpen={isOpen} 
        onClose={onClose}
        CAAddress={CAAddress}
        setCAddress={setCAddress} 
        setIsCA={setIsCA}
        isCA={isCA}
        />
      </Flex>
    </Menu>
  );
}
