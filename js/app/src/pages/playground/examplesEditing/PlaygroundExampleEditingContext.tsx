import type { PropsWithChildren } from "react";
import { createContext, useContext, useState } from "react";
import { useSearchParams } from "react-router";
import { useStore } from "zustand";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { resolvePlaygroundDatasetId } from "@phoenix/pages/playground/playgroundURLSearchParamsUtils";
import { createEditableTableStore } from "@phoenix/store/editableTableStore";
import type {
  EditableTableSession,
  EditableTableStore,
} from "@phoenix/types/table";

import type { PlaygroundExampleTableRow } from "./playgroundExampleEditing";

type PlaygroundExampleEditStore = EditableTableStore<PlaygroundExampleTableRow>;

const PlaygroundExampleEditingContext =
  createContext<PlaygroundExampleEditStore | null>(null);

const createPlaygroundExampleEditStore = (): PlaygroundExampleEditStore =>
  createEditableTableStore<PlaygroundExampleTableRow>({
    getRowId: (row) => row.id,
  });

/**
 * Owns the one edit session for the dataset's examples, so every part of the
 * page that cares about it — the Edit button, the table, the Run button and
 * the navigation blocker — reads the same store. A session belongs to one
 * dataset and split selection: when either changes, the store is replaced
 * by a fresh one and any pending edits go with the old one.
 */
export function PlaygroundExampleEditingProvider({
  children,
}: PropsWithChildren) {
  const [searchParams] = useSearchParams();
  const storeDatasetId = usePlaygroundContext((state) => state.datasetId);
  const datasetId = resolvePlaygroundDatasetId({
    searchParams,
    storeDatasetId,
  });
  const sessionKey = `${datasetId}-${searchParams.getAll("splitId").join("-")}`;

  const [session, setSession] = useState(() => ({
    key: sessionKey,
    store: createPlaygroundExampleEditStore(),
  }));
  // A new dataset gets a new store, decided during render so no render ever
  // sees the previous dataset's session.
  if (session.key !== sessionKey) {
    setSession({ key: sessionKey, store: createPlaygroundExampleEditStore() });
  }

  return (
    <PlaygroundExampleEditingContext.Provider value={session.store}>
      {children}
    </PlaygroundExampleEditingContext.Provider>
  );
}

/** The page's edit session store. */
export function usePlaygroundExampleEditStore(): PlaygroundExampleEditStore {
  const store = useContext(PlaygroundExampleEditingContext);
  if (!store) {
    throw new Error(
      "Missing PlaygroundExampleEditingProvider in the component tree"
    );
  }
  return store;
}

/** Subscribes to a slice of the page's edit session. */
export function usePlaygroundExampleEditing<T>(
  selector: (session: EditableTableSession<PlaygroundExampleTableRow>) => T
): T {
  return useStore(usePlaygroundExampleEditStore(), selector);
}
