import { useState } from "react";
import { ChakraProvider, useDisclosure } from "@chakra-ui/react";
import theme from "./theme";
import Header from "./components/Header";
import AccountModal from "./components/Modal/AccountModal";
import Swap from "./components/Swap";
import "@fontsource/inter";
import "./global.css";

function App() {

  const  { isOpen, onClose } = useDisclosure();

  const [CAAddress, setCAddress] = useState<string>("");
  const [isCA, setIsCA] = useState<boolean>(false);

  return (
    <ChakraProvider theme={theme}>
     
      <Header 
      setCAddress={setCAddress} 
      CAAddress={CAAddress}
      setIsCA={setIsCA} 
      isCA={isCA}  
      /> 

      <AccountModal 
      isOpen={isOpen} 
      onClose={onClose} 
      setCAddress={setCAddress} 
      CAAddress={CAAddress}
      setIsCA={setIsCA} 
      isCA={isCA} 
      />
      <Swap CAAddress={CAAddress} isCA={isCA} />
    </ChakraProvider>
  );
}

export default App;
