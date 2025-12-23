import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs, redirect } from "react-router";
import invariant from "tiny-invariant";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { promptTagRedirectLoaderQuery } from "./__generated__/promptTagRedirectLoaderQuery.graphql";

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
    .catch(() => {
      throw new Error("Prompt version not found");
    });

  invariant(
    response?.prompt && response.prompt.__typename === "Prompt",
    "Prompt not found"
  );

  return redirect(
    `/prompts/${promptId}/versions/${response.prompt.version.id}`
  );
}
