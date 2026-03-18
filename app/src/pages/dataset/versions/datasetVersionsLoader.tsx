import { graphql, loadQuery } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { datasetVersionsLoaderQuery } from "./__generated__/datasetVersionsLoaderQuery.graphql";

/**
 * The loadQuery graphql query node for the dataset versions page.
 * Exported so the component can reference it in usePreloadedQuery.
 */
export const datasetVersionsLoaderQueryNode = graphql`
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
  const queryRef = loadQuery<datasetVersionsLoaderQuery>(
    RelayEnvironment,
    datasetVersionsLoaderQueryNode,
    {
      id: datasetId as string,
    }
  );
  return { queryRef };
}
