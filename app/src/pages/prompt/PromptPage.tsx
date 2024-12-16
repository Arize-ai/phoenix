import React from "react";
import { useLoaderData } from "react-router";

import { Flex, Heading, View } from "@arizeai/components";

import { promptLoaderQuery$data } from "./__generated__/promptLoaderQuery.graphql";

export function PromptPage() {
  const loaderData = useLoaderData() as promptLoaderQuery$data;
  return (
    <Flex direction="column" height="100%">
      <View
        padding="size-200"
        borderBottomWidth="thin"
        borderBottomColor="dark"
        flex="none"
      >
        <Flex direction="row" justifyContent="space-between">
          <Heading level={1}>{loaderData.prompt.name}</Heading>
        </Flex>
      </View>
    </Flex>
  );
}
