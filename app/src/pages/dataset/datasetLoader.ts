import { loadQuery } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { DatasetPageQuery } from "./__generated__/DatasetPageQuery.graphql";
import { DatasetPageQueryNode } from "./DatasetPage";

/**
 * Loads in the necessary page data for the dataset page
 */
export function datasetLoader(args: LoaderFunctionArgs) {
  const { datasetId } = args.params;
  const queryRef = loadQuery<DatasetPageQuery>(
    RelayEnvironment,
    DatasetPageQueryNode,
    {
      id: datasetId as string,
    }
  );

  return {
    queryRef,
  };
}

export type DatasetLoaderData = ReturnType<typeof datasetLoader>;
