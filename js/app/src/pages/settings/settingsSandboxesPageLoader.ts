import { graphql, loadQuery } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { settingsSandboxesPageLoaderQuery } from "./__generated__/settingsSandboxesPageLoaderQuery.graphql";

export const settingsSandboxesPageLoaderGql = graphql`
  query settingsSandboxesPageLoaderQuery {
    ...SettingsSandboxesPageFragment
  }
`;

export function settingsSandboxesPageLoader() {
  return loadQuery<settingsSandboxesPageLoaderQuery>(
    RelayEnvironment,
    settingsSandboxesPageLoaderGql,
    {}
  );
}

export type SettingsSandboxesPageLoaderType = ReturnType<
  typeof settingsSandboxesPageLoader
>;
