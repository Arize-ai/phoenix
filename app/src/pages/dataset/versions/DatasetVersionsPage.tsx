import { Suspense } from "react";
import { usePreloadedQuery } from "react-relay";
import { Outlet, useLoaderData } from "react-router";

import { DatasetHistoryTable } from "@phoenix/pages/dataset/DatasetHistoryTable";

import type { datasetVersionsLoaderQuery as DatasetVersionsLoaderQuery } from "./__generated__/datasetVersionsLoaderQuery.graphql";
import type { DatasetVersionsLoaderData } from "./datasetVersionsLoader";
import { datasetVersionsLoaderQuery } from "./datasetVersionsLoader";

/**
 * Dataset-specific history page that lists dataset version history.
 */
export function DatasetVersionsPage() {
  const loaderData = useLoaderData<DatasetVersionsLoaderData>();
  const data = usePreloadedQuery<DatasetVersionsLoaderQuery>(
    datasetVersionsLoaderQuery,
    loaderData.queryRef
  );
  return (
    <>
      <DatasetHistoryTable dataset={data.dataset} />
      <Suspense>
        <Outlet />
      </Suspense>
    </>
  );
}
