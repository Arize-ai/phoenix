import { Suspense } from "react";
import { Outlet, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { experimentsLoader } from "@phoenix/pages/experiments/experimentsLoader";

import { ExperimentsTable } from "./ExperimentsTable";

export function ExperimentsPage() {
  const loaderData = useLoaderData<typeof experimentsLoader>();
  invariant(loaderData, "loaderData is required");
  return (
    <>
      <ExperimentsTable dataset={loaderData.dataset} />
      <Suspense>
        <Outlet />
      </Suspense>
    </>
  );
}
