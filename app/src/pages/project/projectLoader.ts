import { fetchQuery, graphql } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";
import invariant from "tiny-invariant";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { projectLoaderQuery } from "./__generated__/projectLoaderQuery.graphql";

/**
 * Loads in the necessary page data for the project page
 */
export async function projectLoader(args: LoaderFunctionArgs) {
  const { projectId } = args.params;
  invariant(projectId, "projectId is required by the route definition");
  return await fetchQuery<projectLoaderQuery>(
    RelayEnvironment,
    graphql`
      query projectLoaderQuery($id: ID!) {
        project: node(id: $id) {
          id
          ... on Project {
            name
          }
        }
      }
    `,
    {
      id: projectId,
    }
  ).toPromise();
}

export type ProjectLoaderData = Awaited<ReturnType<typeof projectLoader>>;
