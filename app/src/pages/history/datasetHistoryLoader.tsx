import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { datasetHistoryLoaderQuery } from "./__generated__/datasetHistoryLoaderQuery.graphql";

/**
 * Loads the dataset data required for the dataset history page
 */
export async function datasetHistoryLoader(args: LoaderFunctionArgs) {
  const { datasetId } = args.params;
  return await fetchQuery<datasetHistoryLoaderQuery>(
    RelayEnvironment,
    graphql`
      query datasetHistoryLoaderQuery($id: ID!) {
        dataset: node(id: $id) {
          id
          ... on Dataset {
            id
            ...DatasetHistoryTable_versions
          }
        }
      }
    `,
    {
      id: datasetId as string,
    }
  ).toPromise();
}