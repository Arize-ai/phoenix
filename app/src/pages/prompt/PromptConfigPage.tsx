import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { Flex, View } from "@phoenix/components";
import { promptConfigLoader } from "@phoenix/pages/prompt/promptConfigLoader";

import { PromptVersionTagsConfigCard } from "./PromptVersionTagsConfigCard";

export function PromptConfigPage() {
  const loaderData = useLoaderData<typeof promptConfigLoader>();
  invariant(loaderData, "loaderData is required");

  return (
    <Flex direction="row" height="100%">
      <View
        height="100%"
        overflow="auto"
        width="100%"
        data-testid="scroll-container"
      >
        <View padding="size-200">
          <Flex
            direction="column"
            gap="size-200"
            marginStart="auto"
            marginEnd="auto"
            maxWidth={900}
          >
            <PromptVersionTagsConfigCard prompt={loaderData.prompt} />
          </Flex>
        </View>
      </View>
    </Flex>
  );
}
