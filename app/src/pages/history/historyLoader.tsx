import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { historyLoaderQuery } from "./__generated__/historyLoaderQuery.graphql";

/**
 * Loads the dataset data required for the history page
 */
export async function historyLoader(args: LoaderFunctionArgs) {
  const { datasetId } = args.params;
  return await fetchQuery<historyLoaderQuery>(
    RelayEnvironment,
    graphql`
      query historyLoaderQuery($id: ID!) {
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