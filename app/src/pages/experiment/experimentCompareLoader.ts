import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { experimentCompareLoaderQuery } from "./__generated__/experimentCompareLoaderQuery.graphql";

/**
 * Loads in the necessary page data for the compare experiment page
 */
export async function experimentCompareLoader(args: LoaderFunctionArgs) {
  const { datasetId } = args.params;
  return await fetchQuery<experimentCompareLoaderQuery>(
    RelayEnvironment,
    graphql`
      query experimentCompareLoaderQuery($id: ID!) {
        dataset: node(id: $id) {
          id
          ... on Dataset {
            id
            name
            ...ExperimentMultiSelector__experiments
          }
        }
      }
    `,
    {
      id: datasetId as string,
    }
  ).toPromise();
}
