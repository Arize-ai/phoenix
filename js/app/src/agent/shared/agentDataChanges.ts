/**
 * A data change made by a PXI `ui.*` operation that some mounted UI surface
 * may need to refetch to reflect.
 *
 * Existing records update from mutation payloads in Relay's normalized store.
 * List membership, filters, and dataset version summaries need their query
 * owners to refetch after a PXI write. Handlers emit after a successful write;
 * mounted owners subscribe and refresh their own data.
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
