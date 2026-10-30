import type { componentsV1 } from "@arizeai/phoenix-client";

import { formatTable } from "./formatTable";

export type OutputFormat = "pretty" | "json" | "raw";

type DatasetSplit = componentsV1["schemas"]["DatasetSplit"];

export interface FormatDatasetSplitOutputOptions {
  /**
   * Dataset split returned by the create or update route.
   */
  split: DatasetSplit;
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

/**
 * Format the split returned by `px dataset split create` and
 * `px dataset split update`.
 */
export function formatDatasetSplitOutput({
  split,
  format,
}: FormatDatasetSplitOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(split);
  }
  if (selected === "json") {
    return JSON.stringify(split, null, 2);
  }
  return formatTable([
    {
      name: split.name,
      id: split.id,
      examples: split.example_count,
      description: split.description ?? "",
    },
  ]);
}

export interface DatasetSplitDeleteResult {
  deleted: true;
  dataset: string;
  split_id: string;
}

export interface FormatDatasetSplitDeleteOutputOptions {
  result: DatasetSplitDeleteResult;
  format?: OutputFormat;
}

/**
 * Format the structured success record returned by `px dataset split delete`.
 *
 * The delete endpoint returns no body, so the record echoes the dataset and
 * split that were addressed for downstream callers and audit trails.
 */
export function formatDatasetSplitDeleteOutput({
  result,
  format,
}: FormatDatasetSplitDeleteOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(result);
  }
  if (selected === "json") {
    return JSON.stringify(result, null, 2);
  }
  return `Deleted dataset split ${result.split_id}. Examples were not deleted.`;
}
