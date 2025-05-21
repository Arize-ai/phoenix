import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs } from "react-router";
import invariant from "tiny-invariant";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { projectDashboardLoaderQuery } from "./__generated__/projectDashboardLoaderQuery.graphql";

/**
 * A loader for the project dashboard page
 */
export async function projectDashboardLoader(args: LoaderFunctionArgs) {
  const { projectId } = args.params;
  const loaderData = await fetchQuery<projectDashboardLoaderQuery>(
    RelayEnvironment,
    graphql`
      query projectDashboardLoaderQuery($projectId: ID!) {
        project: node(id: $projectId) {
          ... on Project {
            id
            name
          }
        }
      }
    `,
    { projectId: projectId as string }
  ).toPromise();
  invariant(loaderData, "No loader data");

  return loaderData;
}
