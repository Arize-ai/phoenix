import type { componentsV1 } from "@arizeai/phoenix-client";

import { formatTable } from "./formatTable";

export type OutputFormat = "pretty" | "json" | "raw";

type DatasetEvaluator = componentsV1["schemas"]["DatasetEvaluator"];

export interface FormatDatasetEvaluatorsOutputOptions {
  /**
   * Bindings to format.
   */
  bindings: DatasetEvaluator[];
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

export function formatDatasetEvaluatorsOutput({
  bindings,
  format,
}: FormatDatasetEvaluatorsOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(bindings);
  }
  if (selected === "json") {
    return JSON.stringify(bindings, null, 2);
  }
  return formatDatasetEvaluatorsPretty(bindings);
}

export interface FormatDatasetEvaluatorOutputOptions {
  /**
   * Binding to format.
   */
  binding: DatasetEvaluator;
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

/**
 * Format a single binding. `raw`/`json` emit the object directly so agents
 * can extract fields such as `.id` without indexing.
 */
export function formatDatasetEvaluatorOutput({
  binding,
  format,
}: FormatDatasetEvaluatorOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(binding);
  }
  if (selected === "json") {
    return JSON.stringify(binding, null, 2);
  }
  return formatDatasetEvaluatorsPretty([binding]);
}

function formatDatasetEvaluatorsPretty(bindings: DatasetEvaluator[]): string {
  if (bindings.length === 0) {
    return "No dataset evaluators found";
  }

  const rows = bindings.map((b) => ({
    name: b.name,
    id: b.id,
    type: b.evaluator_type,
    "evaluator id": b.evaluator_id,
    description: b.description ?? "",
  }));

  return formatTable(rows);
}
