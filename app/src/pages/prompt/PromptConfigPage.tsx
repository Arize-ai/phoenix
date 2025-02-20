import React from "react";
import { useLoaderData } from "react-router";

import { Flex, View } from "@phoenix/components";

import { promptConfigLoaderQuery$data } from "./__generated__/promptConfigLoaderQuery.graphql";
import { PromptVersionTagsConfigCard } from "./PromptVersionTagsConfigCard";

export function PromptConfigPage() {
  const data = useLoaderData() as promptConfigLoaderQuery$data;

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
