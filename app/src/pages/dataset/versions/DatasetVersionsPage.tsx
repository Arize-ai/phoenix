import { Suspense } from "react";
import { Outlet, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { DatasetHistoryTable } from "@phoenix/pages/dataset/DatasetHistoryTable";

import { datasetVersionsLoader } from "./datasetVersionsLoader";

/**
 * Dataset-specific history page that lists dataset version history.
 */
export function DatasetVersionsPage() {
  const loaderData = useLoaderData<typeof datasetVersionsLoader>();
  invariant(loaderData, "loaderData is required");
  return (
    <>
      <DatasetHistoryTable dataset={loaderData.dataset} />
      <Suspense>
        <Outlet />
      </Suspense>
    </>
  );
}
