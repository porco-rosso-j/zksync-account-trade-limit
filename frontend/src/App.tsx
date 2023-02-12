import { ChakraProvider, Flex, useMediaQuery } from "@chakra-ui/react";
import theme from "./theme";
import Header from "./components/Header";
import Swap from "./components/Swap";
import "@fontsource/inter";
import "./global.css";


function App() {
  const [isScreenWideEnough] = useMediaQuery("(min-width: 1150px)");

  return (
    <ChakraProvider theme={theme}>
      <Header />
      <Swap />
    </ChakraProvider>
  );
}

export default App;
