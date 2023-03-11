//https://github.com/nguyentung9820/DEX/blob/main/src/components/Modal/TokenModal.tsx//
import {
  Box,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Input,
  Link,
  useColorMode,
  useMediaQuery,
} from "@chakra-ui/react";
// Can use later to make the table pretty but requires more work
// import ReactTable from "react-table";
import { useEffect, useState, Fragment } from "react";
import { Token } from "../../common/Token";
import token_list from "./token_list.json";

type Props = {
  isOpen: any;
  onClose: any;
  selectedToken: Token | null;
  otherToken: Token | null;
  setSelectedToken: any;
};

export default function TokenModal({
  isOpen,
  onClose,
  selectedToken,
  otherToken,
  setSelectedToken,
}: Props) {
  const crypto = token_list.map((x) => Token.fromJSON(x));
  // console.log(crypto);
  const [search, setSearch] = useState<any>("");
  const { colorMode } = useColorMode();
  const [isScreenFullWidth] = useMediaQuery("(min-width: 500px)");

  function getChainExplorerLink(token_addr: string) {
    return `https://goerli.explorer.zksync.io/address/${token_addr}`;
    // return ""; // Should never reach here
  }

  function getTableStyle() {
    return isScreenFullWidth ? { width: "460px", height: "350px", overflow: "scroll", display: "block" } : { width: "calc(92vw)", height: "350px", overflow: "scroll", display: "block" }
  }

  // Used to reset the search text. Otherwise between close and open, the search
  // text remains set (but is invisible)
  // Can later dynamically pull tokens, but we do it statically for now
  useEffect(() => {
    setSearch("");
  }, [isOpen]);
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent
        background={colorMode === "dark" ? "black" : "white"}
        border="0.06rem"
        borderStyle="solid"
        borderColor="gray.300"
        borderRadius="3xl"
        maxW={isScreenFullWidth ? "480px" : "calc(96vw)"}
      >
        <ModalHeader color={colorMode === "dark" ? "white" : "black"} px={4} fontSize="lg" fontWeight="medium">
          Select A Token
        </ModalHeader>
        <ModalCloseButton
          color={colorMode === "dark" ? "white" : "black"}
          fontSize="sm"
          _hover={{
            color: "gray.600",
          }}
        />
        <ModalBody py={0} px={4} >
          <Box
            borderRadius="3xl"
            border="0.06rem"
            borderStyle="solid"
            borderColor="gray.300"
            px={5}
            py={2}
            mb={-5}
          >
            <Input
              placeholder="Search token name / symbol / address"
              fontSize={isScreenFullWidth ? "1.5rem" : "0.95rem"}
              width="100%"
              size="19rem"
              textAlign="left"
              outline="none"
              border="none"
              focusBorderColor="none"
              type="text"
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              color={colorMode === "dark" ? "white" : "black"}
            />
          </Box>
          {/*<Box color="black" display="flex">*/}
          {/*    <img src={imageToShow} alt="logo" width="50px" />*/}
          {/*    <span>{tokenNameToShow}</span>*/}
          {/*</Box>*/}
          <div id="tokenlist" className="App">
            <table
              style={getTableStyle()}
            >
              <thead>
                <tr>
                  <td align="center">Name</td>
                  <td align="center">Symbol</td>
                  <td align="left">Address</td>
                </tr>
              </thead>
              <tbody>
                {
                  crypto
                    .filter((token) => {
                      return (
                        token.symbol
                          .toLowerCase()
                          .includes(search.toLowerCase()) ||
                        token.name
                          .toLowerCase()
                          .includes(search.toLowerCase()) ||
                        token
                          .getAddressFromEncodedTokenName()
                          .includes(search.toLowerCase())
                      );
                    })
                    .map((token, index) => {
                      let hidden = false;
                      let sameAsOtherToken =
                        token.getAddressFromEncodedTokenName() ===
                          otherToken?.getAddressFromEncodedTokenName() //&&
                      if (sameAsOtherToken) {
                        hidden = true;
                      }
                      let href = getChainExplorerLink(token.getAddressFromEncodedTokenName());
                      // I altogether avoid creating the document elements so we can highlight alternating rows
                      // and also it's wasteful to render but hide the objects
                      return (
                        hidden === false && (
                          <Fragment key={index}>
                            <tr
                              id={token.name}
                              key={index}
                              style={{
                                backgroundColor:
                                  token.getAddressFromEncodedTokenName() ===
                                  selectedToken?.getAddressFromEncodedTokenName()
                                    ? "rgb(130, 195, 147)"
                                    : "",
                              }}
                              hidden={hidden}
                              onClick={function (e) {
                                setSelectedToken(token);
                                if (!e.target.toString().includes('http')) {
                                  setTimeout(onClose, 250);
                                }
                              }}
                            >
                              <td className="logo">
                                {/* <a href={token.websiteUrl}>
                                <img src={token.icon} alt="logo" width="30px" />
                              </a> */}
                                <span>{token.name}</span>
                              </td>
                              <td className="symbol">{token.symbol}</td>
                              <td className="address">
                                <Link href={href} isExternal>{token.getAddressFromEncodedTokenName()}</Link>
                              </td>
                            </tr>
                          </Fragment>
                        )
                      );
                    })
                }
              </tbody>
            </table>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
