import { fetchQuery, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { settingsGeneralPageLoaderQuery } from "./__generated__/settingsGeneralPageLoaderQuery.graphql";

export async function settingsGeneralPageLoader() {
  return await fetchQuery<settingsGeneralPageLoaderQuery>(
    RelayEnvironment,
    graphql`
      query settingsGeneralPageLoaderQuery {
        ...DBUsagePieChart_data
      }
    `,
    {}
  ).toPromise();
}
