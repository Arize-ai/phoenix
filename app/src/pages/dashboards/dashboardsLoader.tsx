import { graphql, loadQuery } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { dashboardsLoaderQuery as DashboardsLoaderQuery } from "./__generated__/dashboardsLoaderQuery.graphql";

/**
 * The query for the dashboards loader.
 */
export const dashboardsLoaderQuery = graphql`
  query dashboardsLoaderQuery($hasSelectedProject: Boolean!, $projectId: ID!) {
    ...ProjectSelector_projects
      @arguments(
        hasSelectedProject: $hasSelectedProject
        selectedProjectId: $projectId
      )
  }
`;

/**
 * A loader for the dashboards page
 */
export function dashboardsLoader({ params }: LoaderFunctionArgs) {
  const projectId = params.projectId ?? "";
  const queryRef = loadQuery<DashboardsLoaderQuery>(
    RelayEnvironment,
    dashboardsLoaderQuery,
    {
      hasSelectedProject: Boolean(params.projectId),
      projectId,
    }
  );

  return { queryRef };
}

export type DashboardsLoaderData = ReturnType<typeof dashboardsLoader>;
