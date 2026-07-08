import { Suspense } from "react";
import { Outlet, useLoaderData } from "react-router";

import { useOwnedPreloadedQuery } from "@phoenix/hooks";
import { DatasetHistoryTable } from "@phoenix/pages/dataset/DatasetHistoryTable";

import type { datasetVersionsLoaderQuery as DatasetVersionsLoaderQuery } from "./__generated__/datasetVersionsLoaderQuery.graphql";
import type { DatasetVersionsLoaderData } from "./datasetVersionsLoader";
import { datasetVersionsLoaderQuery } from "./datasetVersionsLoader";

/**
 * Dataset-specific history page that lists dataset version history.
 */
export function DatasetVersionsPage() {
  const loaderData = useLoaderData<DatasetVersionsLoaderData>();
  const data = useOwnedPreloadedQuery<DatasetVersionsLoaderQuery>({
    query: datasetVersionsLoaderQuery,
    queryRef: loaderData.queryRef,
  });
  return (
    <>
      <DatasetHistoryTable dataset={data.dataset} />
      <Suspense>
        <Outlet />
      </Suspense>
    </>
  );
}
