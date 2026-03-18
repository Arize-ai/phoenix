import { Suspense } from "react";
import { usePreloadedQuery } from "react-relay";
import { Outlet, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { DatasetHistoryTable } from "@phoenix/pages/dataset/DatasetHistoryTable";

import type { datasetVersionsLoaderQuery } from "./__generated__/datasetVersionsLoaderQuery.graphql";
import type { datasetVersionsLoader } from "./datasetVersionsLoader";
import { datasetVersionsLoaderQueryNode } from "./datasetVersionsLoader";

/**
 * Dataset-specific history page that lists dataset version history.
 */
export function DatasetVersionsPage() {
  const loaderData = useLoaderData<typeof datasetVersionsLoader>();
  invariant(loaderData, "loaderData is required");
  const data = usePreloadedQuery<datasetVersionsLoaderQuery>(
    datasetVersionsLoaderQueryNode,
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
