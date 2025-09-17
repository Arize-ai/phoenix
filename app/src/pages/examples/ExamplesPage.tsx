import { Suspense, useMemo } from "react";
import { Outlet, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { examplesLoader } from "./examplesLoader";
import { ExamplesTable } from "./ExamplesTable";
import type { examplesLoaderQuery$data } from "./__generated__/examplesLoaderQuery.graphql";

export function ExamplesPage() {
  const loaderData = useLoaderData<typeof examplesLoader>();
  invariant(loaderData, "loaderData is required");
  type DatasetSplitNode = NonNullable<examplesLoaderQuery$data["datasetSplits"]>["edges"][number]["node"];
  const splits = useMemo<DatasetSplitNode[]>(
    () => loaderData.datasetSplits?.edges?.map((e) => e?.node).filter(Boolean) ?? [],
    [loaderData]
  );
  return (
    <>
      <ExamplesTable dataset={loaderData.dataset} splits={splits} />{" "}
      <Suspense>
        <Outlet />
      </Suspense>
    </>
  );
}
