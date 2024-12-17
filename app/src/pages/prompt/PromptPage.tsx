import React from "react";
import { useLoaderData, useNavigate } from "react-router";

import { Button, Flex, Heading, Icon, Icons, View } from "@arizeai/components";

import { promptLoaderQuery$data } from "./__generated__/promptLoaderQuery.graphql";

export function PromptPage() {
  const loaderData = useLoaderData() as promptLoaderQuery$data;
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
          <Heading level={1}>{loaderData.prompt.name}</Heading>
          <Button
            variant="default"
            size="compact"
            icon={<Icon svg={<Icons.Edit2Outline />} />}
            onClick={() => {
              navigate(`/prompts/${loaderData.prompt.id}/playground`);
            }}
          >
            Edit in Playground
          </Button>
        </Flex>
      </View>
    </Flex>
  );
}
