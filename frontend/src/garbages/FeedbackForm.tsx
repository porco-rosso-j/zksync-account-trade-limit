import { useState } from "react";
import { useFormspark } from "@formspark/use-formspark";
import { Box, CloseButton, Stack, Textarea, useColorMode } from "@chakra-ui/react";
import { useEthers } from "@usedapp/core";
import { lavender, turquoise } from "../theme"


type Props = {
  nrows: number;
};

export default function FeedbackForm({ nrows }: Props) {
  const [submit, submitting] = useFormspark({
    formId: "qzGbI7Jw",
  });
  const [message, setMessage] = useState("");
  const [hidden, setHidden] = useState(false);
  const { account, chainId } = useEthers();
  const { colorMode } = useColorMode();
  
  return (
    <Box hidden={hidden}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (message !== "") {
            let annotatedMsg = `${message} (from ${account} on chain ${chainId})`
            await submit({ annotatedMsg });
            // console.log(annotatedMsg);
            console.log('Feedback sent!')
            setMessage("");
            setHidden(true);
          }
        }}
      >
        <Stack alignItems="center">
          <CloseButton onClick={() => setHidden(true)} mr={'17rem'} mb={'-1rem'} />
          <label style={{ fontWeight: "900" }}>
            Suggestions? Feature requests?
            <br />
            We'd love to get your feedback!
          </label>
          <Textarea
            value={message}
            bg={colorMode === "dark" ? "#1e1e1e" : "white"}
            onChange={(e) => setMessage(e.target.value)}
            rows={nrows}
            cols={30}
            placeholder={
              "Or be an OG and join our Discord channel to talk to us in real-time!"
            }
          />
          <button type="submit" disabled={submitting}>
            <Box
              mt="0.5rem"
              color="white"
              bg={lavender}
              width="100%"
              p="0.5rem 1rem"
              borderRadius="1.25rem"
              fontWeight="900"
              _hover={{ bg: turquoise }}
            >
              Send Feedback
            </Box>
          </button>
        </Stack>
      </form>
    </Box>
  );
}


//import FeedbackForm from "./components/FeedbackForm";
      {/* {isScreenWideEnough ? (
        <Flex px="5" position={"absolute"} left="0rem" bottom="2rem">
          <FeedbackForm nrows={5} />
        </Flex>
      ) : (
        <Flex bottom="2rem" justifyContent="center">
          <FeedbackForm nrows={3} />
        </Flex>
      )}
      <Footer /> */}