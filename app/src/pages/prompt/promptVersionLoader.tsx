import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { promptVersionLoaderQuery } from "./__generated__/promptVersionLoaderQuery.graphql";

/**
 * Loads in the necessary page data for the prompt/:promptId/versions/:versionId page
 *
 * In other words, the data required to render a specific version of a prompt
 */
export async function promptVersionLoader(args: LoaderFunctionArgs) {
  const { versionId } = args.params;
  return await fetchQuery<promptVersionLoaderQuery>(
    RelayEnvironment,
    graphql`
      query promptVersionLoaderQuery($id: ID!) {
        promptVersion: node(id: $id) {
          __typename
          id
          ... on PromptVersion {
            ...PromptInvocationParameters__main
            ...PromptChatMessagesCard__main
            ...PromptCodeExportCard__main
            ...PromptModelConfigurationCard__main
            ...PromptVersionTagsList_data
            description
            invocationParameters
            modelName
            tools {
              definition
            }
            tags {
              name
            }
          }
        }
      }
    `,
    {
      id: versionId as string,
    }
  )
    .toPromise()
    .catch(() => {
      throw new Error("Prompt version not found");
    });
}

export type PromptVersionLoaderData = Awaited<
  ReturnType<typeof promptVersionLoader>
>;
