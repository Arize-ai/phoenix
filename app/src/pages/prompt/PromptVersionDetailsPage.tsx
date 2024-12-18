import React from "react";
import { useLoaderData } from "react-router";

import { Card, Flex, View } from "@arizeai/components";

import { promptVersionLoaderQuery$data } from "./__generated__/promptVersionLoaderQuery.graphql";
import { PromptInvocationParameters } from "./PromptInvocationParameters";

export function PromptVersionDetailsPage() {
  const { promptVersion } = useLoaderData() as promptVersionLoaderQuery$data;
  return <PromptVersionDetailsPageContent promptVersion={promptVersion} />;
}

function PromptVersionDetailsPageContent({
  promptVersion,
}: {
  promptVersion: promptVersionLoaderQuery$data["promptVersion"];
}) {
  return (
    <View padding="size-200" width="100%">
      <Flex
        direction="column"
        gap="size-200"
        maxWidth={900}
        marginStart="auto"
        marginEnd="auto"
      >
        <Card title="Model Configuration" variant="compact">
          <PromptInvocationParameters
            invocationParameters={promptVersion.invocationParameters}
          />
        </Card>
      </Flex>
    </View>
  );
}
