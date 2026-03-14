import type { componentsV1 } from "@arizeai/phoenix-client";

import { formatTable } from "./formatTable";

export type OutputFormat = "pretty" | "json" | "raw";

type DatasetExample = componentsV1["schemas"]["DatasetExample"];

export interface DatasetExamplesData {
  dataset_id: string;
  version_id: string;
  filtered_splits?: string[];
  examples: DatasetExample[];
}

export interface FormatDatasetExamplesOutputOptions {
  /**
   * Dataset examples data to format.
   */
  data: DatasetExamplesData;
  /**
   * Dataset name (for display purposes).
   */
  datasetName?: string;
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

export function formatDatasetExamplesOutput({
  data,
  datasetName,
  format,
}: FormatDatasetExamplesOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(data);
  }
  if (selected === "json") {
    return JSON.stringify(data, null, 2);
  }
  return formatDatasetExamplesPretty(data, datasetName);
}

function formatDatasetExamplesPretty(
  data: DatasetExamplesData,
  datasetName?: string
): string {
  const lines: string[] = [];

  // Header
  const displayName = datasetName || data.dataset_id;
  lines.push(`Dataset: ${displayName} (${data.dataset_id})`);
  lines.push(`Version: ${data.version_id}`);

  if (data.filtered_splits && data.filtered_splits.length > 0) {
    lines.push(`Splits: ${data.filtered_splits.join(", ")}`);
  }

  lines.push(`Examples: ${data.examples.length}`);
  lines.push("");

  if (data.examples.length === 0) {
    lines.push("No examples found");
    return lines.join("\n");
  }

  const rows = data.examples.map((example) => ({
    id: example.id,
    input: stringifyCompact(example.input),
    output: stringifyCompact(example.output),
    metadata: stringifyCompact(example.metadata),
  }));

  lines.push(formatTable(rows));

  return lines.join("\n").trimEnd();
}

function stringifyCompact(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return "";
  }
  return JSON.stringify(obj).replace(/\s+/g, " ").trim();
}
