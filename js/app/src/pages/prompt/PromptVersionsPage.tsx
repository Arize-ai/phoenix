import { useCallback } from "react";
import { useFragment, usePreloadedQuery } from "react-relay";
import { Outlet, useParams } from "react-router";
import { graphql } from "relay-runtime";

import { Flex, View } from "@phoenix/components";

import type { promptLoaderQuery as promptLoaderQueryType } from "./__generated__/promptLoaderQuery.graphql";
import type { PromptVersionsPageContent__main$key } from "./__generated__/PromptVersionsPageContent__main.graphql";
import { promptLoaderQuery } from "./promptLoader";
import { PromptVersionsList } from "./PromptVersionsList";
import { usePromptIdLoader } from "./usePromptIdLoader";

/**
 * The prompt's versions beside the selected version, which is the latest
 * version when the URL does not name one
 */
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
  const data = useFragment(
    graphql`
      fragment PromptVersionsPageContent__main on Prompt {
        latestVersion: promptVersions(first: 1) {
          edges {
            node {
              id
            }
          }
        }
        ...PromptVersionsList__main
      }
    `,
    prompt
  );
  const selectedVersionId =
    promptVersionId ?? data.latestVersion.edges[0]?.node.id;
  const itemActive = useCallback(
    (version: { id: string }) => version.id === selectedVersionId,
    [selectedVersionId]
  );
  return (
    <View height="100%">
      <Flex direction="row" height="100%">
        <PromptVersionsList prompt={data} itemActive={itemActive} />
        <Outlet />
      </Flex>
    </View>
  );
}
