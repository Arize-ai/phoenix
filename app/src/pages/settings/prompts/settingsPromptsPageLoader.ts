import { graphql, loadQuery } from "react-relay";

import { settingsPromptsPageLoaderQuery } from "@phoenix/pages/settings/prompts/__generated__/settingsPromptsPageLoaderQuery.graphql";
import RelayEnvironment from "@phoenix/RelayEnvironment";

export const settingsPromptsPageLoaderGql = graphql`
  query settingsPromptsPageLoaderQuery {
    ...PromptLabelsSettingsCardFragment
  }
`;

export function settingsPromptsPageLoader() {
  return loadQuery<settingsPromptsPageLoaderQuery>(
    RelayEnvironment,
    settingsPromptsPageLoaderGql,
    {}
  );
}

export type SettingsPromptsPageLoaderType = ReturnType<
  typeof settingsPromptsPageLoader
>;
