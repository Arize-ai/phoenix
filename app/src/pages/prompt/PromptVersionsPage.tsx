import { useCallback } from "react";
import { useFragment, usePreloadedQuery } from "react-relay";
import { Outlet, useParams } from "react-router";
import { graphql } from "relay-runtime";

import { Flex, View } from "@phoenix/components";

import type { promptLoaderQuery as promptLoaderQueryType } from "./__generated__/promptLoaderQuery.graphql";
import { PromptVersionsPageContent__main$key } from "./__generated__/PromptVersionsPageContent__main.graphql";
import { promptLoaderQuery } from "./promptLoader";
import { PromptVersionsList } from "./PromptVersionsList";
import { usePromptIdLoader } from "./usePromptIdLoader";

export function PromptVersionsPage() {
  const loaderData = usePromptIdLoader();
  const data = usePreloadedQuery<promptLoaderQueryType>(
    promptLoaderQuery,
    loaderData.queryRef
  );
  const prompt = data.prompt;
  const { versionId } = useParams();
  return (
    <PromptVersionsPageContent prompt={prompt} promptVersionId={versionId} />
  );
}

function PromptVersionsPageContent({
  prompt,
  promptVersionId,
}: {
  prompt: PromptVersionsPageContent__main$key;
  promptVersionId?: string;
}) {
  const promptVersions = useFragment(
    graphql`
      fragment PromptVersionsPageContent__main on Prompt {
        ...PromptVersionsList__main
      }
    `,
    prompt
  );
  const itemActive = useCallback(
    (version: { id: string }) => version.id === promptVersionId,
    [promptVersionId]
  );
  return (
    <View height="100%">
      <Flex direction="row" height="100%">
        <PromptVersionsList prompt={promptVersions} itemActive={itemActive} />
        <Outlet />
      </Flex>
    </View>
  );
}
