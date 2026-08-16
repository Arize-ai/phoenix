import { parseListDatasetExamplesInput } from "@phoenix/agent/tools/datasetExamples";
import { parseListDatasetsInput } from "@phoenix/agent/tools/listDatasets";

import type { ToolInvocationPart } from "./toolPartTypes";

/** Summary chip for list_datasets: the active name filter, if any. */
export function getListDatasetsToolPreview(part: ToolInvocationPart): string {
  const input = parseListDatasetsInput(part.input);
  if (!input) return "";
  return input.nameContains ? `name contains "${input.nameContains}"` : "";
}

/** Summary chip for list_dataset_examples: the requested row limit, if any. */
export function getListDatasetExamplesToolPreview(
  part: ToolInvocationPart
): string {
  const input = parseListDatasetExamplesInput(part.input);
  if (!input) return "";
  return input.limit != null ? `up to ${input.limit} rows` : "";
}
