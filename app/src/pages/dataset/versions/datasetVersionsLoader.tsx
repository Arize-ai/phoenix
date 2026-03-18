import { graphql, loadQuery } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";
import invariant from "tiny-invariant";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { datasetVersionsLoaderQuery as DatasetVersionsLoaderQuery } from "./__generated__/datasetVersionsLoaderQuery.graphql";

/**
 * The query node for the dataset versions loader, exported so the consuming component
 * can reference it in usePreloadedQuery.
 */
export const datasetVersionsLoaderQuery = graphql`
  query datasetVersionsLoaderQuery($id: ID!) {
    dataset: node(id: $id) {
      id
      ... on Dataset {
        id
        ...DatasetHistoryTable_versions
      }
    }
  }
`;

/**
 * Loads the dataset data required for the dataset history page
 */
export function datasetVersionsLoader(args: LoaderFunctionArgs) {
  const { datasetId } = args.params;
  invariant(datasetId, "datasetId is required");
  const queryRef = loadQuery<DatasetVersionsLoaderQuery>(
    RelayEnvironment,
    datasetVersionsLoaderQuery,
    { id: datasetId }
  );
  return { queryRef };
}

export type DatasetVersionsLoaderData = ReturnType<
  typeof datasetVersionsLoader
>;
