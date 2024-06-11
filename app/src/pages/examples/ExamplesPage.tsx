import React, { Suspense } from "react";
import { Outlet, useLoaderData } from "react-router";

import { examplesLoaderQuery$data } from "./__generated__/examplesLoaderQuery.graphql";
import { ExamplesTable } from "./ExamplesTable";

export function ExamplesPage() {
  const loaderData = useLoaderData() as examplesLoaderQuery$data;
  return (
    <>
      <ExamplesTable dataset={loaderData.dataset} />{" "}
      <Suspense>
        <Outlet />
      </Suspense>
    </>
  );
}
