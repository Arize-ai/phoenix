import { Suspense } from "react";
import { Outlet, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { historyLoader } from "./historyLoader";
import { DatasetHistoryTable } from "@phoenix/pages/dataset/DatasetHistoryTable";

export function HistoryPage() {
  const loaderData = useLoaderData<typeof historyLoader>();
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