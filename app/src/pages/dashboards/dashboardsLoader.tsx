import { graphql, loadQuery } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { dashboardsLoaderQuery as DashboardsLoaderQuery } from "./__generated__/dashboardsLoaderQuery.graphql";

/**
 * The query for the dashboards loader.
 */
export const dashboardsLoaderQuery = graphql`
  query dashboardsLoaderQuery {
    ...ProjectDashboardsTable_projects
  }
`;

/**
 * A loader for the dashboards page
 */
export function dashboardsLoader() {
  const queryRef = loadQuery<DashboardsLoaderQuery>(
    RelayEnvironment,
    dashboardsLoaderQuery,
    {}
  );

  return { queryRef };
}

export type DashboardsLoaderData = ReturnType<typeof dashboardsLoader>;
