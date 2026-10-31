import { fetchQuery, graphql } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { projectLoaderQuery } from "./__generated__/projectLoaderQuery.graphql";

/**
 * Loads in the necessary page data for the project page
 */
export async function projectLoader(args: LoaderFunctionArgs) {
  const { projectId } = args.params;
  return await fetchQuery<projectLoaderQuery>(
    RelayEnvironment,
    graphql`
      query projectLoaderQuery($id: ID!) {
        project: node(id: $id) {
          id
          ... on Project {
            name
            # Fetched on every visit, so the Relay store answer that
            # ProjectOnboardingOverlay decides from on mount is never stale.
            hasTraces
          }
        }
      }
    `,
    {
      id: projectId as string,
    }
  ).toPromise();
}

export type ProjectLoaderData = Awaited<ReturnType<typeof projectLoader>>;
