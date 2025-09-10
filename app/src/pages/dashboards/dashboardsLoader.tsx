import { fetchQuery, graphql } from "react-relay";
import invariant from "tiny-invariant";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { dashboardsLoaderQuery } from "./__generated__/dashboardsLoaderQuery.graphql";

/**
 * A loader for the dashboards page
 */
export async function dashboardsLoader() {
  const loaderData = await fetchQuery<dashboardsLoaderQuery>(
    RelayEnvironment,
    graphql`
      query dashboardsLoaderQuery {
        ...ProjectDashboardsTable_projects
      }
    `,
    {}
  ).toPromise();
  invariant(loaderData, "No loader data");

  return loaderData;
}
