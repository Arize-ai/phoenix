import { Suspense } from "react";
import { usePreloadedQuery } from "react-relay";
import { Outlet, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { ExamplesFilterBar } from "@phoenix/features/datasets/pages/examples/ExamplesFilterBar";
import { ExamplesFilterProvider } from "@phoenix/features/datasets/pages/examples/ExamplesFilterContext";

import type { examplesLoader } from "./examplesLoader";
import { examplesLoaderGql } from "./examplesLoader";
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
