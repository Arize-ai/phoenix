import type { componentsV1 } from "@arizeai/phoenix-client";

export type OutputFormat = "pretty" | "json" | "raw";

type Experiment = componentsV1["schemas"]["Experiment"];
type ExperimentRun = componentsV1["schemas"]["ExperimentRun"];

export interface ExperimentWithRuns {
  experiment: Experiment;
  runs: ExperimentRun[];
}

export interface FormatExperimentOutputOptions {
  /**
   * Experiment data to format.
   */
  data: ExperimentWithRuns;
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

export function formatExperimentOutput({
  data,
  format,
}: FormatExperimentOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(data);
  }
  if (selected === "json") {
    return JSON.stringify(data, null, 2);
  }
  return formatExperimentPretty(data);
}

function formatExperimentPretty(data: ExperimentWithRuns): string {
  const { experiment, runs } = data;
  const lines: string[] = [];

  const projectInfo = experiment.project_name
    ? ` [Project: ${experiment.project_name}]`
    : "";

  lines.push(`┌─ Experiment: ${experiment.id}${projectInfo}`);
  lines.push(`│`);
  lines.push(`│  Dataset ID: ${experiment.dataset_id}`);
  lines.push(`│  Version ID: ${experiment.dataset_version_id}`);
  lines.push(`│  Examples: ${experiment.example_count}`);
  lines.push(`│  Repetitions: ${experiment.repetitions}`);
  lines.push(`│`);
  lines.push(`│  Run Summary:`);
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

  if (runs.length > 0) {
    lines.push(`│`);
    lines.push(`│  Runs (${runs.length}):`);

    for (const run of runs) {
      const status = run.error ? "✗" : "✓";
      const duration = formatDurationMs(run.start_time, run.end_time);
      const traceInfo = run.trace_id ? ` [trace: ${run.trace_id}]` : "";
      const repInfo =
        run.repetition_number > 1 ? ` (rep ${run.repetition_number})` : "";

      lines.push(`│    ${status} ${run.id}${repInfo} - ${duration}${traceInfo}`);

      if (run.error) {
        lines.push(`│      Error: ${truncate(run.error, 80)}`);
      }

      if (run.output !== null && run.output !== undefined) {
        const outputPreview = truncate(
          typeof run.output === "string"
            ? run.output
            : JSON.stringify(run.output),
          100
        );
        lines.push(`│      Output: ${outputPreview}`);
      }
    }
  }

  lines.push(`└─`);

  return lines.join("\n");
}

/**
 * Format raw experiment JSON data from the API
 */
export interface FormatExperimentJsonOutputOptions {
  /**
   * Raw JSON data from the experiment endpoint.
   */
  jsonData: string;
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

export function formatExperimentJsonOutput({
  jsonData,
  format,
}: FormatExperimentJsonOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    // Return as compact JSON
    try {
      const parsed = JSON.parse(jsonData);
      return JSON.stringify(parsed);
    } catch {
      return jsonData;
    }
  }
  if (selected === "json") {
    // Return as pretty JSON
    try {
      const parsed = JSON.parse(jsonData);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return jsonData;
    }
  }
  // Pretty format - parse and format nicely
  return formatExperimentJsonPretty(jsonData);
}

function formatExperimentJsonPretty(jsonData: string): string {
  try {
    const data = JSON.parse(jsonData);
    const lines: string[] = [];

    // Handle array of experiment runs from the JSON endpoint
    if (Array.isArray(data)) {
      lines.push(`Experiment Runs (${data.length}):`);
      lines.push("");

      for (const run of data) {
        const status = run.error ? "✗" : "✓";
        const runId = run.id || run.run_id || "unknown";

        lines.push(`┌─ ${status} Run: ${runId}`);

        if (run.example_id || run.dataset_example_id) {
          lines.push(`│  Example ID: ${run.example_id || run.dataset_example_id}`);
        }

        if (run.repetition_number) {
          lines.push(`│  Repetition: ${run.repetition_number}`);
        }

        if (run.start_time && run.end_time) {
          lines.push(`│  Duration: ${formatDurationMs(run.start_time, run.end_time)}`);
        }

        if (run.trace_id) {
          lines.push(`│  Trace ID: ${run.trace_id}`);
        }

        if (run.error) {
          lines.push(`│  Error: ${truncate(run.error, 100)}`);
        }

        if (run.output !== null && run.output !== undefined) {
          const outputStr =
            typeof run.output === "string"
              ? run.output
              : JSON.stringify(run.output);
          lines.push(`│  Output: ${truncate(outputStr, 200)}`);
        }

        if (run.input !== null && run.input !== undefined) {
          const inputStr =
            typeof run.input === "string"
              ? run.input
              : JSON.stringify(run.input);
          lines.push(`│  Input: ${truncate(inputStr, 200)}`);
        }

        if (run.expected_output !== null && run.expected_output !== undefined) {
          const expectedStr =
            typeof run.expected_output === "string"
              ? run.expected_output
              : JSON.stringify(run.expected_output);
          lines.push(`│  Expected: ${truncate(expectedStr, 200)}`);
        }

        // Handle evaluations
        if (run.evaluations && Object.keys(run.evaluations).length > 0) {
          lines.push(`│  Evaluations:`);
          for (const [name, result] of Object.entries(run.evaluations)) {
            const evalResult = result as {
              score?: number;
              label?: string;
              explanation?: string;
            };
            const parts: string[] = [];
            if (evalResult.score !== undefined && evalResult.score !== null) {
              parts.push(`score=${evalResult.score}`);
            }
            if (evalResult.label !== undefined && evalResult.label !== null) {
              parts.push(`label="${evalResult.label}"`);
            }
            lines.push(`│    - ${name}: ${parts.join(", ")}`);
          }
        }

        lines.push(`└─`);
        lines.push("");
      }

      return lines.join("\n").trimEnd();
    }

    // Fallback for non-array data
    return JSON.stringify(data, null, 2);
  } catch {
    return jsonData;
  }
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString();
  } catch {
    return dateStr;
  }
}

function formatDurationMs(startTime: string, endTime: string): string {
  try {
    const startMs = Date.parse(startTime);
    const endMs = Date.parse(endTime);
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      return "n/a";
    }
    const durationMs = Math.max(0, endMs - startMs);
    if (durationMs < 1000) {
      return `${durationMs}ms`;
    }
    if (durationMs < 60000) {
      return `${(durationMs / 1000).toFixed(2)}s`;
    }
    return `${(durationMs / 60000).toFixed(2)}m`;
  } catch {
    return "n/a";
  }
}

function truncate(str: string, maxLength: number): string {
  const cleaned = str.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return `${cleaned.slice(0, maxLength)}…`;
}
