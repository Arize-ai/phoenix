import type { componentsV1 } from "@arizeai/phoenix-client";

export type OutputFormat = "pretty" | "json" | "raw";

type Dataset = componentsV1["schemas"]["Dataset"];

export interface FormatDatasetsOutputOptions {
  /**
   * Datasets to format.
   */
  datasets: Dataset[];
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

export function formatDatasetsOutput({
  datasets,
  format,
}: FormatDatasetsOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(datasets);
  }
  if (selected === "json") {
    return JSON.stringify(datasets, null, 2);
  }
  return formatDatasetsPretty(datasets);
}

function formatDatasetsPretty(datasets: Dataset[]): string {
  if (datasets.length === 0) {
    return "No datasets found";
  }

  const lines: string[] = [];
  lines.push("Datasets:");
  lines.push("");

  for (const dataset of datasets) {
    const desc =
      dataset.description === null ||
      dataset.description === undefined ||
      dataset.description === ""
        ? ""
        : ` — ${dataset.description}`;

    lines.push(`┌─ ${dataset.name} (${dataset.id})`);
    lines.push(`│  Examples: ${dataset.example_count}`);
    lines.push(`│  Created: ${formatDate(dataset.created_at)}`);
    lines.push(`│  Updated: ${formatDate(dataset.updated_at)}`);
    if (desc) {
      lines.push(`│  Description:${desc}`);
    }
    lines.push(`└─`);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

export interface FormatDatasetOutputOptions {
  /**
   * Dataset to format.
   */
  dataset: Dataset;
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

export function formatDatasetOutput({
  dataset,
  format,
}: FormatDatasetOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(dataset);
  }
  if (selected === "json") {
    return JSON.stringify(dataset, null, 2);
  }
  return formatDatasetPretty(dataset);
}

function formatDatasetPretty(dataset: Dataset): string {
  const lines: string[] = [];
  const desc =
    dataset.description === null ||
    dataset.description === undefined ||
    dataset.description === ""
      ? ""
      : ` — ${dataset.description}`;

  lines.push(`┌─ Dataset: ${dataset.name} (${dataset.id})`);
  lines.push(`│`);
  lines.push(`│  Examples: ${dataset.example_count}`);
  lines.push(`│  Created: ${formatDate(dataset.created_at)}`);
  lines.push(`│  Updated: ${formatDate(dataset.updated_at)}`);
  if (desc) {
    lines.push(`│  Description:${desc}`);
  }
  if (dataset.metadata && Object.keys(dataset.metadata).length > 0) {
    lines.push(`│  Metadata: ${JSON.stringify(dataset.metadata)}`);
  }
  lines.push(`└─`);

  return lines.join("\n");
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString();
  } catch {
    return dateStr;
  }
}
