import { fetchQuery, graphql, loadQuery } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { projectLoaderQuery as ProjectLoaderQuery } from "./__generated__/projectLoaderQuery.graphql";

export const projectLoaderQuery = graphql`
  query projectLoaderQuery($id: ID!) {
    project: node(id: $id) {
      id
      ... on Project {
        name
      }
    }
  }
`;

/**
 * Loads in the necessary page data for the project page
 */
export async function projectLoader(args: LoaderFunctionArgs) {
  const { projectId } = args.params;
  const queryRef = loadQuery<ProjectLoaderQuery>(
    RelayEnvironment,
    projectLoaderQuery,
    {
      id: projectId as string,
    }
  );

  // Also fetch the data for breadcrumbs
  const data = await fetchQuery<ProjectLoaderQuery>(
    RelayEnvironment,
    projectLoaderQuery,
    {
      id: projectId as string,
    }
  ).toPromise();

  return {
    queryRef,
    project: data?.project,
  };
}

export type ProjectLoaderData = Awaited<ReturnType<typeof projectLoader>>;
