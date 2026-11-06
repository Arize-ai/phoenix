import type { ExampleWithId } from "../../types/datasets";

/**
 * The example's node GlobalID, which experiment runs record as their
 * `dataset_example_id`. Servers that predate the `nodeId` field deliver the
 * GlobalID in the `id` field instead.
 */
export function getExampleGlobalId(
  example: Pick<ExampleWithId, "id"> & Partial<Pick<ExampleWithId, "nodeId">>
): string {
  return example.nodeId ?? example.id;
}
