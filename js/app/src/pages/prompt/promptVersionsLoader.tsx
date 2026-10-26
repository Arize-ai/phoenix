import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { fetchQuery, graphql } from "relay-runtime";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { promptVersionsLoaderQuery } from "./__generated__/promptVersionsLoaderQuery.graphql";

/**
 * This loader will redirect to the latest version of the prompt or decision if
 * no versionId is provided in url params
 */
export async function promptVersionsLoader({ params }: LoaderFunctionArgs) {
  const versionId = params.versionId;
  if (versionId) {
    return null;
  }
  const promptId = params.promptId;
  // we don't have a versionId, so we need to fetch the latest version of the prompt or
  // decision and redirect to its page
  const response = await fetchQuery<promptVersionsLoaderQuery>(
    RelayEnvironment,
    graphql`
      query promptVersionsLoaderQuery($id: ID!) {
        prompt: node(id: $id) {
          __typename
          ... on Prompt {
            promptVersions(first: 1) {
              edges {
                promptVersion: node {
                  id
                }
              }
            }
          }
          ... on Decision {
            latestVersion: version {
              id
            }
          }
        }
      }
    `,
    {
      id: promptId as string,
    }
  ).toPromise();

  const node = response?.prompt;
  if (node?.__typename === "Decision") {
    if (!node.latestVersion) {
      throw new Error("Decision does not have any versions");
    }
    return redirect(`/prompts/${promptId}/versions/${node.latestVersion.id}`);
  }
  if (node?.__typename !== "Prompt" || !node.promptVersions.edges.length) {
    throw new Error("Prompt does not have any versions");
  }

  const promptVersion = node.promptVersions.edges[0].promptVersion;
  return redirect(`/prompts/${promptId}/versions/${promptVersion.id}`);
}
