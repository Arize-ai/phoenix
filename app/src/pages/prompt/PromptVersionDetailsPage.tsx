import React from "react";
import { useLoaderData } from "react-router";

import { Text, View } from "@arizeai/components";

import { promptVersionLoaderQuery$data } from "./__generated__/promptVersionLoaderQuery.graphql";

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
    <View padding="size-200">
      <Text>{promptVersion.description}</Text>
    </View>
  );
}
