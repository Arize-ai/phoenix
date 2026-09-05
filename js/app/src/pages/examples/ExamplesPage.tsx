import { Suspense, useCallback, useEffect, useState } from "react";
import type { BlockerFunction } from "react-router";
import { Outlet, useBlocker, useLoaderData } from "react-router";
import invariant from "tiny-invariant";
import { useStore } from "zustand";

import { ConfirmNavigationDialog } from "@phoenix/components/ConfirmNavigation";
import {
  createEditableTableStore,
  getEditableTableChangeCount,
} from "@phoenix/components/table";
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
  // An edit session lives only in memory, so leaving the page drops it.
  const changeCount = useStore(editStore, getEditableTableChangeCount);
  // A save holds its changes in the store until the committed rows come back, so
  // they are still counted while saving — but they are no longer unsaved, and
  // warning about them there would call a successful save "unsaved changes".
  const isSaving = useStore(editStore, (state) => state.mode === "saving");
  const hasUnsavedChanges = changeCount > 0 && !isSaving;
  const shouldBlockNavigation = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname,
    [hasUnsavedChanges]
  );
  const blocker = useBlocker(shouldBlockNavigation);
  // The router only sees navigations within the app; a reload or a closed tab
  // needs the browser's own guard.
  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);
  return (
    <ExamplesFilterProvider>
      <ExamplesFilterBar editStore={editStore} />
      <ExamplesTable dataset={data.dataset} editStore={editStore} />
      <ConfirmNavigationDialog
        blocker={blocker}
        message={`Leaving this page will discard ${changeCount} unsaved change${
          changeCount === 1 ? "" : "s"
        } to the dataset examples.`}
      />
      <Suspense>
        <Outlet />
      </Suspense>
    </ExamplesFilterProvider>
  );
}
