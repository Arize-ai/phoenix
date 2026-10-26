import { loadQuery } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { fetchQuery, graphql } from "relay-runtime";
import invariant from "tiny-invariant";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { latestPromptVersionLoaderQuery } from "./__generated__/latestPromptVersionLoaderQuery.graphql";
import type { promptVersionLoaderQuery as PromptVersionLoaderQuery } from "./__generated__/promptVersionLoaderQuery.graphql";
import type { PromptVersionLoaderData } from "./promptVersionLoader";
import { promptVersionLoaderQuery } from "./promptVersionLoader";

/**
 * Loads the prompt's latest version for the prompt/:promptId page, which shows
 * the latest version without naming it in the URL
 */
export async function latestPromptVersionLoader({
  params,
}: LoaderFunctionArgs): Promise<PromptVersionLoaderData> {
  const { promptId } = params;
  invariant(promptId, "promptId is required");
  const response = await fetchQuery<latestPromptVersionLoaderQuery>(
    RelayEnvironment,
    graphql`
      query latestPromptVersionLoaderQuery($id: ID!) {
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
    { id: promptId },
    { fetchPolicy: "network-only" }
  ).toPromise();

  const latestVersion =
    response?.prompt?.promptVersions?.edges?.[0]?.promptVersion;
  if (!latestVersion) {
    throw new Error("Prompt does not have any versions");
  }
  const queryRef = loadQuery<PromptVersionLoaderQuery>(
    RelayEnvironment,
    promptVersionLoaderQuery,
    { id: latestVersion.id }
  );
  return { queryRef };
}

/**
 * prompt/:promptId/versions has no content of its own; versions are browsed
 * from prompt/:promptId
 */
export function promptVersionsRedirectLoader({ params }: LoaderFunctionArgs) {
  return redirect(`/prompts/${params.promptId}`);
}
