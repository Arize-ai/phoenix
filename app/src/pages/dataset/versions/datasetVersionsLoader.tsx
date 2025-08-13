import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { datasetVersionsLoaderQuery } from "./__generated__/datasetVersionsLoaderQuery.graphql";

/**
 * Loads the dataset data required for the dataset history page
 */
export async function datasetVersionsLoader(args: LoaderFunctionArgs) {
  const { datasetId } = args.params;
  return await fetchQuery<datasetVersionsLoaderQuery>(
    RelayEnvironment,
    graphql`
      query datasetVersionsLoaderQuery($id: ID!) {
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
