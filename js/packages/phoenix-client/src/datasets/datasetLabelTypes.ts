import type { components, operations } from "../__generated__/api/v1";

/** A reusable label resource that can be assigned to one or more datasets. */
export type DatasetLabel = components["schemas"]["DatasetLabel"];

/** Fields required to create a global dataset label resource. */
export type CreateDatasetLabelInput =
  components["schemas"]["CreateDatasetLabelRequestBody"];

/** Fields that can be changed on a global dataset label resource. */
export type UpdateDatasetLabelInput =
  components["schemas"]["UpdateDatasetLabelRequestBody"];

/** Query parameters accepted by the global dataset-label list endpoint. */
export type ListDatasetLabelsQuery = NonNullable<
  operations["listDatasetLabels"]["parameters"]["query"]
>;

type ListDatasetLabelsResponse =
  operations["listDatasetLabels"]["responses"]["200"]["content"]["application/json"];

/** One page of global dataset labels. */
export type ListDatasetLabelsResult = {
  datasetLabels: ListDatasetLabelsResponse["data"];
  nextCursor: ListDatasetLabelsResponse["next_cursor"];
};
