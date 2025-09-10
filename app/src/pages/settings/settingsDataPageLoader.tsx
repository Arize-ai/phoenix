import { fetchQuery, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { settingsDataPageLoaderQuery } from "./__generated__/settingsDataPageLoaderQuery.graphql";

export async function settingsDataPageLoader() {
  return await fetchQuery<settingsDataPageLoaderQuery>(
    RelayEnvironment,
    graphql`
      query settingsDataPageLoaderQuery {
        __id
        ...RetentionPoliciesTable_policies
      }
    `,
    {}
  ).toPromise();
}
