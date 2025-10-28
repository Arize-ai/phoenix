import { graphql, loadQuery } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { settingsGeneralPageLoaderQuery } from "./__generated__/settingsGeneralPageLoaderQuery.graphql";

export const settingsGeneralPageLoaderGQL = graphql`
  query settingsGeneralPageLoaderQuery {
    ...DBUsagePieChart_data
  }
`;

export function settingsGeneralPageLoader() {
  return loadQuery<settingsGeneralPageLoaderQuery>(
    RelayEnvironment,
    settingsGeneralPageLoaderGQL,
    {}
  );
}

export type settingsGeneralPageLoaderType = ReturnType<
  typeof settingsGeneralPageLoader
>;
