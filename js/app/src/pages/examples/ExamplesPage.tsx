import { Suspense } from "react";
import { Outlet, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { useOwnedPreloadedQuery } from "@phoenix/hooks";
import { ExamplesFilterBar } from "@phoenix/pages/examples/ExamplesFilterBar";
import { ExamplesFilterProvider } from "@phoenix/pages/examples/ExamplesFilterContext";

import type { examplesLoaderQuery } from "./__generated__/examplesLoaderQuery.graphql";
import type { examplesLoader } from "./examplesLoader";
import { examplesLoaderGql } from "./examplesLoader";
import { ExamplesTable } from "./ExamplesTable";

export function ExamplesPage() {
  const loaderData = useLoaderData<typeof examplesLoader>();
  invariant(loaderData, "loaderData is required");
  const data = useOwnedPreloadedQuery<examplesLoaderQuery>({
    query: examplesLoaderGql,
    queryRef: loaderData,
  });
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
