import { graphql, loadQuery } from "react-relay";

import type { settingsDecisionsPageLoaderQuery } from "@phoenix/pages/settings/decisions/__generated__/settingsDecisionsPageLoaderQuery.graphql";
import RelayEnvironment from "@phoenix/RelayEnvironment";

export const settingsDecisionsPageLoaderGql = graphql`
  query settingsDecisionsPageLoaderQuery {
    ...DecisionLabelsSettingsCardFragment
  }
`;

export function settingsDecisionsPageLoader() {
  return loadQuery<settingsDecisionsPageLoaderQuery>(
    RelayEnvironment,
    settingsDecisionsPageLoaderGql,
    {}
  );
}

export type SettingsDecisionsPageLoaderType = ReturnType<
  typeof settingsDecisionsPageLoader
>;
