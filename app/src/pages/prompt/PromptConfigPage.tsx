import { usePreloadedQuery } from "react-relay";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { Flex, View } from "@phoenix/components";
import type { PromptConfigLoaderData } from "@phoenix/pages/prompt/promptConfigLoader";
import { promptConfigLoaderQuery } from "@phoenix/pages/prompt/promptConfigLoader";

import type { promptConfigLoaderQuery as PromptConfigLoaderQuery } from "./__generated__/promptConfigLoaderQuery.graphql";
import { PromptVersionTagsConfigCard } from "./PromptVersionTagsConfigCard";

export function PromptConfigPage() {
  const loaderData = useLoaderData<PromptConfigLoaderData>();
  invariant(loaderData, "loaderData is required");
  const data = usePreloadedQuery<PromptConfigLoaderQuery>(
    promptConfigLoaderQuery,
    loaderData.queryRef
  );

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
            <PromptVersionTagsConfigCard prompt={data.prompt} />
          </Flex>
        </View>
      </View>
    </Flex>
  );
}
