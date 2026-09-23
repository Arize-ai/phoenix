import { ConnectionHandler } from "relay-runtime";

/**
 * Root-level Relay connection ids that PXI mutations insert into or delete
 * from, mirroring what the UI's own create/delete flows do. Every key listed
 * here is declared with `@connection(key: ...)` on a root query whose only
 * arguments are pagination (`first`/`after`), so the id is knowable without
 * the caller's filter values. A key whose connection is not mounted is
 * skipped by Relay's mutation handlers with a dev-only warning.
 */

/** Dataset pickers (playground, span-to-dataset dialog). Edge type `DatasetEdge`. */
export const DATASET_PICKER_CONNECTION_KEYS = [
  "DatasetPicker__datasets",
  "DatasetPickerWithSplits__datasets",
] as const;

/** Every list of dataset labels. Edge type `DatasetLabelEdge`. */
export const DATASET_LABEL_CONNECTION_KEYS = [
  "DatasetLabelConfigButtonAllLabels_datasetLabels",
  "DatasetLabelFilterButton_datasetLabels",
  "DatasetLabelsTable__datasetLabels",
] as const;

/** The manage-splits dialog list. Edge type `DatasetSplitEdge`. */
export const DATASET_SPLIT_CONNECTION_KEYS = [
  "ManageDatasetSplitsDialog_datasetSplits",
] as const;

/** Resolve root connection keys to the ids Relay's `connections` arguments expect. */
export function getRootConnectionIds(keys: readonly string[]): string[] {
  return keys.map((key) =>
    ConnectionHandler.getConnectionID("client:root", key)
  );
}
