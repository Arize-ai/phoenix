import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs, redirect } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { promptTagRedirectLoaderQuery } from "./__generated__/promptTagRedirectLoaderQuery.graphql";

/**
 * Loads a prompt version by tag name and redirects to the prompt version details page
 */
export async function promptTagRedirectLoader(args: LoaderFunctionArgs) {
  const { tagName, promptId } = args.params;

  if (!promptId) {
    throw new Error("Prompt ID is required");
  }

  if (!tagName) {
    throw new Error("Tag name is required");
  }

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
    .catch(() => {
      throw new Error("Prompt version not found");
    });

  if (!response?.prompt || response.prompt.__typename !== "Prompt") {
    throw new Error("Prompt not found");
  }

  return redirect(
    `/prompts/${promptId}/versions/${response.prompt.version.id}`
  );
}
