import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { settingsModelsLoaderQuery } from "./__generated__/settingsModelsLoaderQuery.graphql";

/**
 * Loads in the necessary page data for the models page
 */
export async function settingsModelsLoader(_args: LoaderFunctionArgs) {
  const data = await fetchQuery<settingsModelsLoaderQuery>(
    RelayEnvironment,
    graphql`
      query settingsModelsLoaderQuery {
        ...ModelsTable_generativeModels
      }
    `,
    {}
  ).toPromise();

  if (!data) {
    throw new Error("Failed to load models");
  }

  return data;
}
