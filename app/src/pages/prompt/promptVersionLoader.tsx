import { graphql, loadQuery } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";
import invariant from "tiny-invariant";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { promptVersionLoaderQuery as PromptVersionLoaderQuery } from "./__generated__/promptVersionLoaderQuery.graphql";

/**
 * Query for prompt version loader.
 */
export const promptVersionLoaderQuery = graphql`
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

        tags {
          name
        }
        ...PromptVersionDiffView__template
        previousVersion {
          ...PromptVersionDiffView__template
        }
      }
    }
  }
`;

/**
 * Loads in the necessary page data for the prompt/:promptId/versions/:versionId page
 *
 * In other words, the data required to render a specific version of a prompt
 */
export function promptVersionLoader(args: LoaderFunctionArgs) {
  const { versionId } = args.params;
  invariant(versionId, "versionId is required");
  const queryRef = loadQuery<PromptVersionLoaderQuery>(
    RelayEnvironment,
    promptVersionLoaderQuery,
    { id: versionId }
  );
  return { queryRef };
}

export type PromptVersionLoaderData = ReturnType<typeof promptVersionLoader>;
