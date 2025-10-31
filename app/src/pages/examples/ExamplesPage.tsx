import { Suspense } from "react";
import { usePreloadedQuery } from "react-relay";
import { Outlet, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { ExamplesFilterBar } from "@phoenix/pages/examples/ExamplesFilterBar";
import { ExamplesFilterProvider } from "@phoenix/pages/examples/ExamplesFilterContext";

import { examplesLoader, examplesLoaderGql } from "./examplesLoader";
import { ExamplesTable } from "./ExamplesTable";

export function ExamplesPage() {
  const loaderData = useLoaderData<typeof examplesLoader>();
  invariant(loaderData, "loaderData is required");
  const data = usePreloadedQuery(examplesLoaderGql, loaderData);
  return (
    <ExamplesFilterProvider>
      <ExamplesFilterBar />
      <ExamplesTable dataset={data.dataset} />
      <Suspense>
        <Outlet />
      </Suspense>
    </ExamplesFilterProvider>
  );
}
