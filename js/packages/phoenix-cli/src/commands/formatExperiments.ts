import type { componentsV1 } from "@arizeai/phoenix-client";

import { formatTable } from "./formatTable";

export type OutputFormat = "pretty" | "json" | "raw";

type Experiment = componentsV1["schemas"]["Experiment"];

export interface FormatExperimentsOutputOptions {
  /**
   * Experiments to format.
   */
  experiments: Experiment[];
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

export function formatExperimentsOutput({
  experiments,
  format,
}: FormatExperimentsOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(experiments);
  }
  if (selected === "json") {
    return JSON.stringify(experiments, null, 2);
  }
  return formatExperimentsPretty(experiments);
}

function formatExperimentsPretty(experiments: Experiment[]): string {
  if (experiments.length === 0) {
    return "No experiments found";
  }

  const rows = experiments.map((e) => ({
    id: e.id,
    project: e.project_name ?? "",
    dataset_id: e.dataset_id,
    examples: e.example_count,
    successful: e.successful_run_count,
    failed: e.failed_run_count,
    missing: e.missing_run_count,
    created: formatDate(e.created_at),
  }));

  return formatTable(rows);
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString();
  } catch {
    return dateStr;
  }
}
