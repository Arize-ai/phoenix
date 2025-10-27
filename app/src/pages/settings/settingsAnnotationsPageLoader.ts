import { graphql, loadQuery } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { settingsAnnotationsPageLoaderQuery } from "./__generated__/settingsAnnotationsPageLoaderQuery.graphql";

export const settingsAnnotationsPageLoaderGql = graphql`
  query settingsAnnotationsPageLoaderQuery {
    ...SettingsAnnotationsPageFragment
  }
`;

export function settingsAnnotationsPageLoader() {
  return loadQuery<settingsAnnotationsPageLoaderQuery>(
    RelayEnvironment,
    settingsAnnotationsPageLoaderGql,
    {}
  );
}

export type SettingsAnnotationsPageLoaderType = ReturnType<
  typeof settingsAnnotationsPageLoader
>;
