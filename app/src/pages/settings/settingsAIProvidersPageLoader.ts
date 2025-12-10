import { fetchQuery, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { settingsAIProvidersPageLoaderQuery } from "./__generated__/settingsAIProvidersPageLoaderQuery.graphql";

export async function settingsAIProvidersPageLoader() {
  return await fetchQuery<settingsAIProvidersPageLoaderQuery>(
    RelayEnvironment,
    graphql`
      query settingsAIProvidersPageLoaderQuery {
        ...GenerativeProvidersCard_data
        ...CustomProvidersCard_data
      }
    `,
    {}
  ).toPromise();
}
