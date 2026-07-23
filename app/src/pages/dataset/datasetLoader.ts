import { fetchQuery, loadQuery } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { DatasetPageQuery } from "./__generated__/DatasetPageQuery.graphql";
import { DatasetPageQueryNode } from "./DatasetPage";

/**
 * Loads in the necessary page data for the dataset page
 */
export async function datasetLoader(args: LoaderFunctionArgs) {
  const { datasetId } = args.params;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- datasetId is guaranteed present by the :datasetId route param
  const id = datasetId as string;
  const queryRef = loadQuery<DatasetPageQuery>(
    RelayEnvironment,
    DatasetPageQueryNode,
    {
      id,
    }
  );

  // Also fetch the data for breadcrumbs (can be sync from cache)
  const data = await fetchQuery<DatasetPageQuery>(
    RelayEnvironment,
    DatasetPageQueryNode,
    {
      id,
    }
  ).toPromise();

  return {
    queryRef,
    dataset: data?.dataset,
  };
}

export type DatasetLoaderData = Awaited<ReturnType<typeof datasetLoader>>;
