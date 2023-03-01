import { useState } from "react";
import { ChakraProvider, Flex, useMediaQuery, useDisclosure } from "@chakra-ui/react";
import theme from "./theme";
import Header from "./components/Header";
import AccountModal from "./components/Modal/AccountModal";
import Swap from "./components/Swap";
import "@fontsource/inter";
import "./global.css";
// import { _isAccountOwner } from "./common/Account"
//import { useEthers } from "@usedapp/core";

function App() {

  const  { isOpen, onClose } = useDisclosure();
  //const { account, deactivate } = useEthers();

  const [CAAddress, setCAddress] = useState<string>("");
  const [isCA, setIsCA] = useState<boolean>(false);
  // const isOwner :boolean | undefined = CAAddress ? _isAccountOwner(CAAddress, account) : undefined;
  // const [isOnwe, setIsOnwer] = useState<boolean>(false);

  // function setIsOnwer(

  //)
  console.log("CAAddress:", CAAddress)
  console.log("isCA:", isCA)
  // console.log("isOwner:", isOwner)

  return (
    <ChakraProvider theme={theme}>
     
      <Header 
      setCAddress={setCAddress} 
      CAAddress={CAAddress}
      setIsCA={setIsCA} 
      isCA={isCA}  
      // isOwner={isOwner ? isOwner : false}
      /> 

      <AccountModal 
      isOpen={isOpen} 
      onClose={onClose} 
      setCAddress={setCAddress} 
      CAAddress={CAAddress}
      setIsCA={setIsCA} 
      isCA={isCA} 
      // isOwner={isOwner ? isOwner : false}
      />
      <Swap CAAddress={CAAddress} isCA={isCA} />
    </ChakraProvider>
  );
}

export default App;
