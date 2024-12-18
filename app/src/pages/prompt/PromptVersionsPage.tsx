import React from "react";
import { useFragment } from "react-relay";
import { Outlet } from "react-router";
import { graphql } from "relay-runtime";

import { Flex, View } from "@arizeai/components";

import { PromptVersionsPageContent__main$key } from "./__generated__/PromptVersionsPageContent__main.graphql";
import { PromptVersionsList } from "./PromptVersionsList";
import { usePromptIdLoader } from "./usePromptIdLoader";

export function PromptVersionsPage() {
  // TODO: Add a loader that will redirect to the latest version
  // Landing on /versions alone is not a good user experience
  const { prompt } = usePromptIdLoader();
  return <PromptVersionsPageContent prompt={prompt} />;
}

function PromptVersionsPageContent({
  prompt,
}: {
  prompt: PromptVersionsPageContent__main$key;
}) {
  const promptVersions = useFragment(
    graphql`
      fragment PromptVersionsPageContent__main on Prompt {
        ...PromptVersionsList__main
      }
    `,
    prompt
  );
  return (
    <View height="100%">
      <Flex direction="row" height="100%">
        <PromptVersionsList prompt={promptVersions} />
        <Outlet />
      </Flex>
    </View>
  );
}
