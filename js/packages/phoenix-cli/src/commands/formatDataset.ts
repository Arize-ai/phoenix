import type { componentsV1 } from "@arizeai/phoenix-client";

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

  // Examples
  for (const example of data.examples) {
    lines.push(`┌─ Example: ${example.id}`);

    const inputPreview = truncateJson(example.input, 150);
    lines.push(`│  Input: ${inputPreview}`);

    const outputPreview = truncateJson(example.output, 150);
    lines.push(`│  Output: ${outputPreview}`);

    if (example.metadata && Object.keys(example.metadata).length > 0) {
      const metadataPreview = truncateJson(example.metadata, 100);
      lines.push(`│  Metadata: ${metadataPreview}`);
    }

    lines.push(`└─`);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function truncateJson(obj: unknown, maxLength: number): string {
  if (obj === null || obj === undefined) {
    return "null";
  }

  let str: string;
  try {
    str = JSON.stringify(obj);
  } catch {
    str = String(obj);
  }

  // Clean up whitespace for display
  str = str.replace(/\s+/g, " ").trim();

  if (str.length <= maxLength) {
    return str;
  }

  return `${str.slice(0, maxLength)}…`;
}
