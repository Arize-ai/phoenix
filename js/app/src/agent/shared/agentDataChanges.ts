import { useEffect } from "react";

/**
 * A data change made by a PXI `ui.*` operation that some mounted UI surface
 * may need to refetch to reflect.
 *
 * Most PXI writes keep the UI current through Relay's normalized store: the
 * mutation returns the fields the page renders and Relay re-renders every
 * consumer of that record. Two kinds of surface cannot be updated that way:
 *
 * - Paginated, filtered connections (the datasets table sorts and filters
 *   server-side, so its connection id is not knowable from a root handler).
 *   The UI's own create/delete/edit flows refetch it via a `fetchKey` bump.
 * - The examples table, which refetches when the dataset's latest version
 *   changes. The UI's own row edits call `refreshLatestVersion` after their
 *   mutation; PXI handlers run outside React and cannot reach that store.
 *
 * Handlers emit a change after a successful mutation; the pages that own
 * those surfaces subscribe and do exactly what their own buttons do.
 */
export type AgentDataChange =
  /** A dataset was created, edited, or deleted. */
  | { entity: "datasets" }
  /** Rows of one dataset changed (add/patch/delete/add spans). */
  | { entity: "datasetExamples"; datasetId: string }
  /** Instance-wide dataset labels changed (created/deleted/reassigned). */
  | { entity: "datasetLabels" }
  /** Instance-wide dataset splits changed (created/deleted/patched/assigned). */
  | { entity: "datasetSplits" };

type Listener = (change: AgentDataChange) => void;

const listeners = new Set<Listener>();

/** Notify subscribers that a PXI operation changed server data. */
export function emitAgentDataChange(change: AgentDataChange): void {
  for (const listener of listeners) {
    try {
      listener(change);
    } catch {
      // One surface's refresh failing must not stop the others.
    }
  }
}

/** Subscribe to PXI data changes; returns the unsubscribe function. */
export function subscribeToAgentDataChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * React hook form of {@link subscribeToAgentDataChanges}. The latest
 * `listener` is always the one invoked, so callers can pass an inline
 * closure without re-subscribing on every render.
 */
export function useAgentDataChange(listener: Listener): void {
  useEffect(() => {
    return subscribeToAgentDataChanges(listener);
  }, [listener]);
}
