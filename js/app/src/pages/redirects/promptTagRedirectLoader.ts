import { fetchQuery, graphql } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import invariant from "tiny-invariant";

import { ServerResponseError } from "@phoenix/components/exception/serverConnectionError";
import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { promptTagRedirectLoaderQuery } from "./__generated__/promptTagRedirectLoaderQuery.graphql";
import { notFound } from "./notFound";

/**
 * Loads a prompt version by tag name and redirects to the prompt version details page
 */
export async function promptTagRedirectLoader(args: LoaderFunctionArgs) {
  const { tagName, promptId } = args.params;

  invariant(promptId, "Prompt ID is required");
  invariant(tagName, "Tag name is required");

  const response = await fetchQuery<promptTagRedirectLoaderQuery>(
    RelayEnvironment,
    graphql`
      query promptTagRedirectLoaderQuery(
        $promptId: ID!
        $tagName: Identifier!
      ) {
        prompt: node(id: $promptId) {
          __typename
          ... on Prompt {
            version(tagName: $tagName) {
              id
            }
          }
        }
      }
    `,
    {
      promptId: promptId,
      tagName: tagName,
    }
  )
    .toPromise()
    .catch((error: unknown) => {
      // A tagged response means Phoenix's GraphQL endpoint did not answer, so
      // it cannot establish whether the prompt or tag exists.
      if (
        error instanceof Error &&
        (error.message === "Failed to fetch" ||
          error instanceof ServerResponseError)
      ) {
        throw error;
      }
      return null;
    });

  if (!response?.prompt || response.prompt.__typename !== "Prompt") {
    throw notFound({
      kind: "entity",
      entityType: "prompt version",
      identifier: tagName,
    });
  }

  return redirect(
    `/prompts/${promptId}/versions/${response.prompt.version.id}`
  );
}
