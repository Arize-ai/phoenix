import { graphql, loadQuery } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import {
  settingsDataPageLoaderQuery,
  settingsDataPageLoaderQuery$variables,
} from "./__generated__/settingsDataPageLoaderQuery.graphql";

export const settingsDataPageLoaderGql = graphql`
  query settingsDataPageLoaderQuery {
    ...RetentionPoliciesTable_policies
  }
`;

export function settingsDataPageLoader() {
  return loadQuery<
    settingsDataPageLoaderQuery,
    settingsDataPageLoaderQuery$variables
  >(RelayEnvironment, settingsDataPageLoaderGql, {});
}

export type SettingsDataLoaderType = ReturnType<typeof settingsDataPageLoader>;
