import { useNavigate } from "react-router";

import {
  Button,
  ExternalLinkButton,
  Flex,
  Icon,
  Icons,
  Text,
  Video,
  View,
} from "@phoenix/components";

export function PromptsEmpty() {
  const navigate = useNavigate();

  return (
    <View width="100%" paddingY="size-400">
      <Flex
        direction="column"
        width="100%"
        alignItems="center"
        justifyContent="center"
      >
        <View width="100%" maxWidth="780px">
          <Flex direction="column" gap="size-400" alignItems="center">
            <Text size="XL">
              Create and manage prompt templates for your AI applications.
            </Text>
            <Video
              src="https://storage.googleapis.com/arize-phoenix-assets/assets/videos/prompts.mp4"
              autoPlay
              muted
              loop
            />
            <Flex direction="row" gap="size-200">
              <ExternalLinkButton
                href="https://arize.com/docs/phoenix/get-started/get-started-prompt-playground"
                target="_blank"
                leadingVisual={<Icon svg={<Icons.BookOutline />} />}
              >
                Documentation
              </ExternalLinkButton>
              <Button
                variant="primary"
                leadingVisual={<Icon svg={<Icons.PlayCircleOutline />} />}
                onPress={() => navigate("/playground")}
              >
                Playground
              </Button>
            </Flex>
          </Flex>
        </View>
      </Flex>
    </View>
  );
}
