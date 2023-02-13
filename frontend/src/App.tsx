import { ChakraProvider, Flex, useMediaQuery, useDisclosure } from "@chakra-ui/react";
import theme from "./theme";
import Header from "./components/Header";
import ConnectButton from "./components/ConnectButton";
import AccountModal from "./components/Modal/AccountModal";
import Swap from "./components/Swap";
import "@fontsource/inter";
import "./global.css";


function App() {

  const  { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <ChakraProvider theme={theme}>
      <Header />
      <AccountModal isOpen={isOpen} onClose={onClose} />
      <Swap />
    </ChakraProvider>
  );
}

export default App;
