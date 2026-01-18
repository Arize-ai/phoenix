import type { componentsV1 } from "@arizeai/phoenix-client";

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

  const lines: string[] = [];
  lines.push("Experiments:");
  lines.push("");

  for (const experiment of experiments) {
    const projectInfo = experiment.project_name
      ? ` [Project: ${experiment.project_name}]`
      : "";

    lines.push(`┌─ ${experiment.id}${projectInfo}`);
    lines.push(`│  Dataset ID: ${experiment.dataset_id}`);
    lines.push(`│  Version ID: ${experiment.dataset_version_id}`);
    lines.push(`│  Examples: ${experiment.example_count}`);
    lines.push(`│  Repetitions: ${experiment.repetitions}`);
    lines.push(`│`);
    lines.push(`│  Runs:`);
    lines.push(`│    ✓ Successful: ${experiment.successful_run_count}`);
    lines.push(`│    ✗ Failed: ${experiment.failed_run_count}`);
    lines.push(`│    ○ Missing: ${experiment.missing_run_count}`);
    lines.push(`│`);
    lines.push(`│  Created: ${formatDate(experiment.created_at)}`);
    lines.push(`│  Updated: ${formatDate(experiment.updated_at)}`);
    if (
      experiment.metadata &&
      Object.keys(experiment.metadata as object).length > 0
    ) {
      lines.push(`│  Metadata: ${JSON.stringify(experiment.metadata)}`);
    }
    lines.push(`└─`);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString();
  } catch {
    return dateStr;
  }
}
