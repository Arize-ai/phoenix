import type { DatasetIdentifier } from "../types/datasets";

/** Resolve a typed dataset selector to the REST path identifier. */
export function resolveDatasetIdentifier(dataset: DatasetIdentifier): string {
  return "datasetName" in dataset ? dataset.datasetName : dataset.datasetId;
}
