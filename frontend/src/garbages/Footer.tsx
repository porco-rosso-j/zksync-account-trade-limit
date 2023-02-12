import { ReactNode, useEffect, useState } from "react";
// import {
//   Flex,
//   Menu,
//   Image,
//   useColorMode,
//   VStack,
//   HStack,
//   useDisclosure,
//   Button,
//   Switch,
//   useColorModeValue,
//   Text,
// } from "@chakra-ui/react";

// import light_phat_logo from "../assets/light_phat_contract_logo.svg";
// import dark_phat_logo from "../assets/dark_phat_contract_logo.svg";
// import AccountModal from "./Modal/AccountModal";
// import { SocialIcon } from "react-social-icons";
// import ConnectButton from "./ConnectButton";

// type Props = {
//   children?: ReactNode;
// };

// export default function Layout({ children }: Props) {
//   const { isOpen, onOpen, onClose } = useDisclosure();
//   const { colorMode, toggleColorMode } = useColorMode();
//   const [isDarkMode, setIsDarkMode] = useState(colorMode === "dark");
//   const phat_logo = isDarkMode ? dark_phat_logo : light_phat_logo;

//   useEffect(() => setIsDarkMode(colorMode === "dark"), [colorMode]);

//   return (
//     <Flex justifyContent='flex-end'>
//       <HStack mx="1.5rem" mt="1.5rem">
//         <Text as="b">Powered by</Text>
//         <Image boxSize="6rem" src={phat_logo} alt="Phat Contract" />
//       </HStack>
//     </Flex>
//   );
// }

//import Footer from "./components/Footer";
