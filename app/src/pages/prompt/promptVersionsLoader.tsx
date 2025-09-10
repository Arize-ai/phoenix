/**
 * This loader will redirect to the latest version of the prompt if no versionId
 * is provided in url params
 */
import { LoaderFunctionArgs, redirect } from "react-router";
import { fetchQuery, graphql } from "relay-runtime";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { promptVersionsLoaderQuery } from "./__generated__/promptVersionsLoaderQuery.graphql";

/**
 * This loader will redirect to the latest version of the prompt if no versionId
 * is provided in url params
 */
export async function promptVersionsLoader({ params }: LoaderFunctionArgs) {
  const versionId = params.versionId;
  if (versionId) {
    return null;
  }
  const promptId = params.promptId;
  // we don't have a versionId, so we need to fetch the 1 promptVersion from the prompt and redirect
  // to its page
  const response = await fetchQuery<promptVersionsLoaderQuery>(
    RelayEnvironment,
    graphql`
      query promptVersionsLoaderQuery($id: ID!) {
        prompt: node(id: $id) {
          ... on Prompt {
            promptVersions(first: 1) {
              edges {
                promptVersion: node {
                  id
                }
              }
            }
          }
        }
      }
    `,
    {
      id: promptId as string,
    }
  ).toPromise();

  if (!response?.prompt?.promptVersions?.edges?.length) {
    throw new Error("Prompt does not have any versions");
  }

  const promptVersion = response.prompt.promptVersions.edges[0].promptVersion;
  return redirect(`/prompts/${promptId}/versions/${promptVersion.id}`);
}
