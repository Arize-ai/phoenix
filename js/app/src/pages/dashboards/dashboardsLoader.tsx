import { graphql, loadQuery } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { dashboardsLoaderQuery as DashboardsLoaderQuery } from "./__generated__/dashboardsLoaderQuery.graphql";

/**
 * The query for the dashboards loader.
 *
 * Note: the selected project (from the route params) is deliberately not
 * fetched here. It may no longer exist (e.g. a stale URL or remembered id for
 * a deleted project), and a failed lookup would fail the entire query and
 * take down the page. The ProjectMenu resolves the selected project's name
 * on its own and degrades gracefully when the project is not found.
 */
export const dashboardsLoaderQuery = graphql`
  query dashboardsLoaderQuery {
    ...ProjectMenu_projects
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
