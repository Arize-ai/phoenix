import { Suspense, useState } from "react";
import { Outlet, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { createEditableTableStore } from "@phoenix/components/table";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";
import { ExamplesFilterBar } from "@phoenix/pages/examples/ExamplesFilterBar";
import { ExamplesFilterProvider } from "@phoenix/pages/examples/ExamplesFilterContext";

import type { examplesLoaderQuery } from "./__generated__/examplesLoaderQuery.graphql";
import type { DatasetExampleTableRow } from "./datasetExampleTableTypes";
import type { examplesLoader } from "./examplesLoader";
import { examplesLoaderGql } from "./examplesLoader";
import { ExamplesTable } from "./ExamplesTable";

export function ExamplesPage() {
  const [editStore] = useState(() =>
    createEditableTableStore<DatasetExampleTableRow>({
      getRowId: (row) => row.id,
    })
  );
  const loaderData = useLoaderData<typeof examplesLoader>();
  invariant(loaderData, "loaderData is required");
  const data = useOwnedPreloadedQuery<examplesLoaderQuery>({
    query: examplesLoaderGql,
    queryRef: loaderData,
  });
  return (
    <ExamplesFilterProvider>
      <ExamplesFilterBar editStore={editStore} />
      <ExamplesTable dataset={data.dataset} editStore={editStore} />
      <Suspense>
        <Outlet />
      </Suspense>
    </ExamplesFilterProvider>
  );
}
