import type { componentsV1 } from "@arizeai/phoenix-client";

import { formatTable } from "./formatTable";

export type OutputFormat = "pretty" | "json" | "raw";

type ProjectEvaluator = componentsV1["schemas"]["ProjectEvaluator"];

export interface FormatProjectEvaluatorsOutputOptions {
  /**
   * Bindings to format.
   */
  bindings: ProjectEvaluator[];
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

export function formatProjectEvaluatorsOutput({
  bindings,
  format,
}: FormatProjectEvaluatorsOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(bindings);
  }
  if (selected === "json") {
    return JSON.stringify(bindings, null, 2);
  }
  return formatProjectEvaluatorsPretty(bindings);
}

export interface FormatProjectEvaluatorOutputOptions {
  /**
   * Binding to format.
   */
  binding: ProjectEvaluator;
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

/**
 * Format a single binding. `raw`/`json` emit the object directly so agents
 * can extract fields such as `.id` without indexing.
 */
export function formatProjectEvaluatorOutput({
  binding,
  format,
}: FormatProjectEvaluatorOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(binding);
  }
  if (selected === "json") {
    return JSON.stringify(binding, null, 2);
  }
  return formatProjectEvaluatorsPretty([binding]);
}

function formatProjectEvaluatorsPretty(bindings: ProjectEvaluator[]): string {
  if (bindings.length === 0) {
    return "No project evaluators found";
  }

  const rows = bindings.map((b) => ({
    name: b.name,
    id: b.id,
    type: b.evaluator_type,
    target: b.evaluation_target,
    sampling: b.sampling_rate,
    delay: b.evaluation_delay_seconds ?? "",
    enabled: b.enabled ? "yes" : "no",
    filter: b.filter_condition,
  }));

  return formatTable(rows);
}
