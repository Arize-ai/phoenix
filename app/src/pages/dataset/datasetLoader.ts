import { loadQuery } from "react-relay";
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

  // Wait for the query to resolve so we can use the data for breadcrumbs
  // @ts-expect-error - accessing internal source property
  const result = await queryRef.source.toPromise();
  // @ts-expect-error - GraphQL response typing
  const data = result?.data as DatasetPageQuery["response"] | undefined;

  return {
    queryRef,
    dataset: data?.dataset,
  };
}
