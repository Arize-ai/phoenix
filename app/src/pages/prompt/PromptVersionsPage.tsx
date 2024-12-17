import React from "react";
import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { PromptVersionsPageContent__main$key } from "./__generated__/PromptVersionsPageContent__main.graphql";
import { usePromptIdLoader } from "./usePromptIdLoader";

export function PromptVersionsPage() {
  const { prompt } = usePromptIdLoader();
  return <PromptVersionsPageContent prompt={prompt} />;
}

function PromptVersionsPageContent({
  prompt,
}: {
  prompt: PromptVersionsPageContent__main$key;
}) {
  const data = useFragment(
    graphql`
      fragment PromptVersionsPageContent__main on Prompt {
        createdAt
      }
    `,
    prompt
  );
  return <div>versions: {data.createdAt}</div>;
}
