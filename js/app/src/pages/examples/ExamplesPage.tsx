import { Suspense, useState } from "react";
import { Outlet, useLoaderData } from "react-router";
import invariant from "tiny-invariant";
import { useStore } from "zustand";

import { ConfirmNavigationDialog } from "@phoenix/components/ConfirmNavigation";
import {
  useOwnedPreloadedQuery,
  useUnsavedChangesBlocker,
} from "@phoenix/hooks";
import { ExamplesFilterBar } from "@phoenix/pages/examples/ExamplesFilterBar";
import { ExamplesFilterProvider } from "@phoenix/pages/examples/ExamplesFilterContext";
import {
  createEditableTableStore,
  getEditableTableChangeCount,
  hasEditableTableUnsavedChanges,
} from "@phoenix/store/editableTableStore";

import type { examplesLoaderQuery } from "./__generated__/examplesLoaderQuery.graphql";
import type { DatasetExampleTableRow } from "./datasetExampleTableTypes";
import type { examplesLoader } from "./examplesLoader";
import { examplesLoaderGql } from "./examplesLoader";
import { ExamplesTable } from "./ExamplesTable";
import { describeUnsavedExampleChanges } from "./unsavedExampleChanges";

export function ExamplesPage() {
  // One edit session per mounted page. DatasetPage keys its subtree on the
  // dataset, so a change of dataset starts from a fresh store.
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
  // An edit session lives only in memory, so leaving the page drops it.
  const changeCount = useStore(editStore, getEditableTableChangeCount);
  const hasUnsavedChanges = useStore(editStore, hasEditableTableUnsavedChanges);
  const blocker = useUnsavedChangesBlocker({ hasUnsavedChanges });
  return (
    <ExamplesFilterProvider>
      <ExamplesFilterBar editStore={editStore} />
      <ExamplesTable dataset={data.dataset} editStore={editStore} />
      <ConfirmNavigationDialog
        blocker={blocker}
        message={`Leaving this page will discard ${describeUnsavedExampleChanges(
          { count: changeCount }
        )}.`}
      />
      <Suspense>
        <Outlet />
      </Suspense>
    </ExamplesFilterProvider>
  );
}
