import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { modelsLoaderQuery } from "./__generated__/modelsLoaderQuery.graphql";

/**
 * Loads in the necessary page data for the models page
 */
export async function modelsLoader(_args: LoaderFunctionArgs) {
  const data = await fetchQuery<modelsLoaderQuery>(
    RelayEnvironment,
    graphql`
      query modelsLoaderQuery {
        ...ModelsTable_models
      }
    `,
    {}
  ).toPromise();

  if (!data) {
    throw new Error("Failed to load models");
  }

  return data;
}
