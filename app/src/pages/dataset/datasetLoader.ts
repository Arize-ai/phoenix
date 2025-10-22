import { fetchQuery, loadQuery } from "react-relay";
import { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { DatasetPageQuery } from "./__generated__/DatasetPageQuery.graphql";
import { DatasetPageQueryNode } from "./DatasetPage";

/**
 * Loads in the necessary page data for the dataset page
 */
export async function datasetLoader(args: LoaderFunctionArgs) {
  const { datasetId } = args.params;
  const queryRef = loadQuery<DatasetPageQuery>(
    RelayEnvironment,
    DatasetPageQueryNode,
    {
      id: datasetId as string,
    }
  );

  // Also fetch the data for breadcrumbs (can be sync from cache)
  const data = await fetchQuery<DatasetPageQuery>(
    RelayEnvironment,
    DatasetPageQueryNode,
    {
      id: datasetId as string,
    }
  ).toPromise();

  return {
    queryRef,
    dataset: data?.dataset,
  };
}
