import React from "react";
import { useLoaderData } from "react-router";

import { Button, Flex, Heading, Icon, Icons, View } from "@arizeai/components";

import { promptsLoaderQuery$data } from "./__generated__/promptsLoaderQuery.graphql";
import { PromptsTable } from "./PromptsTable";

export function PromptsPage() {
  const loaderData = useLoaderData() as promptsLoaderQuery$data;
  return (
    <Flex direction="column" height="100%">
      <View
        padding="size-200"
        borderBottomWidth="thin"
        borderBottomColor="dark"
        flex="none"
      >
        <Flex direction="row" justifyContent="space-between">
          <Heading level={1}>Prompts</Heading>
          <Button
            variant="default"
            size="compact"
            icon={<Icon svg={<Icons.PlusOutline />} />}
          >
            Prompt Template
          </Button>
        </Flex>
      </View>
      <PromptsTable query={loaderData} />
    </Flex>
  );
}
