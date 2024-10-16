import React, { Suspense } from "react";
import { Outlet, useLoaderData } from "react-router";

import { experimentsLoaderQuery$data } from "./__generated__/experimentsLoaderQuery.graphql";
import { ExperimentsTable } from "./ExperimentsTable";

export function ExperimentsPage() {
  const loaderData = useLoaderData() as experimentsLoaderQuery$data;
  return (
    <>
      <ExperimentsTable dataset={loaderData.dataset} />
      <Suspense>
        <Outlet />
      </Suspense>
    </>
  );
}
