import { Suspense } from "react";
import { Outlet, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { datasetHistoryLoader } from "./datasetHistoryLoader";
import { DatasetHistoryTable } from "@phoenix/pages/dataset/DatasetHistoryTable";

/**
 * Dataset-specific history page that lists dataset version history.
 */
export function DatasetHistoryPage() {
  const loaderData = useLoaderData<typeof datasetHistoryLoader>();
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