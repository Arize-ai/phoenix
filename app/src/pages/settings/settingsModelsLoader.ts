import { graphql, loadQuery } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import {
  settingsModelsLoaderQuery,
  settingsModelsLoaderQuery$variables,
} from "./__generated__/settingsModelsLoaderQuery.graphql";

export const settingsModelsLoaderGql = graphql`
  query settingsModelsLoaderQuery {
    ...ModelsTable_generativeModels
  }
`;

/**
 * Loads in the necessary page data for the models page
 */
export function settingsModelsLoader() {
  return loadQuery<
    settingsModelsLoaderQuery,
    settingsModelsLoaderQuery$variables
  >(RelayEnvironment, settingsModelsLoaderGql, {});
}

export type SettingsModelsLoaderType = ReturnType<typeof settingsModelsLoader>;
