import { graphql, loadQuery } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { settingsSecretsPageLoaderQuery } from "./__generated__/settingsSecretsPageLoaderQuery.graphql";

export const settingsSecretsPageLoaderGql = graphql`
  query settingsSecretsPageLoaderQuery {
    ...SettingsSecretsPageFragment
  }
`;

export function settingsSecretsPageLoader() {
  return loadQuery<settingsSecretsPageLoaderQuery>(
    RelayEnvironment,
    settingsSecretsPageLoaderGql,
    {}
  );
}

export type SettingsSecretsPageLoaderType = ReturnType<
  typeof settingsSecretsPageLoader
>;
