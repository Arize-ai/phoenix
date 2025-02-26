import { fetchQuery, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { settingsPageLoaderQuery } from "./__generated__/settingsPageLoaderQuery.graphql";

export async function settingsPageLoader() {
  return await fetchQuery<settingsPageLoaderQuery>(
    RelayEnvironment,
    graphql`
      query settingsPageLoaderQuery {
        ...GenerativeProvidersCard_data
        ...DBUsagePieChart_data
      }
    `,
    {}
  ).toPromise();
}
