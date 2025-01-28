import React from "react";
import { useLoaderData, useNavigate } from "react-router";

import { Button, Flex, Heading, Icon, Icons, View } from "@phoenix/components";

import { promptsLoaderQuery$data } from "./__generated__/promptsLoaderQuery.graphql";
import { PromptsTable } from "./PromptsTable";

export function PromptsPage() {
  const loaderData = useLoaderData() as promptsLoaderQuery$data;
  const navigate = useNavigate();
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
            size="S"
            icon={<Icon svg={<Icons.PlusOutline />} />}
            onPress={() => {
              navigate("/playground");
            }}
          >
            Create Prompt
          </Button>
        </Flex>
      </View>
      <PromptsTable query={loaderData} />
    </Flex>
  );
}
