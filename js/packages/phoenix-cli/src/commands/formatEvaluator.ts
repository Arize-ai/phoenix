import type { componentsV1 } from "@arizeai/phoenix-client";

import { formatTable } from "./formatTable";

export type OutputFormat = "pretty" | "json" | "raw";

type EvaluatorDefinition =
  componentsV1["schemas"]["EvaluatorDefinitionResponseBody"]["data"];
type CodeEvaluatorVersion = componentsV1["schemas"]["CodeEvaluatorVersion"];
type CreatedCodeEvaluatorVersion =
  componentsV1["schemas"]["CreatedCodeEvaluatorVersion"];

export interface FormatEvaluatorOutputOptions {
  /**
   * Evaluator definition to format.
   */
  evaluator: EvaluatorDefinition;
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

/**
 * Format a shared evaluator definition. `raw`/`json` emit the object directly
 * so agents can extract fields such as `.id`; `pretty` renders a single-row
 * table with the fields common to every kind plus the kind's own identifying
 * field.
 */
export function formatEvaluatorOutput({
  evaluator,
  format,
}: FormatEvaluatorOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(evaluator);
  }
  if (selected === "json") {
    return JSON.stringify(evaluator, null, 2);
  }
  return formatTable([evaluatorRow(evaluator)]);
}

export interface FormatEvaluatorsOutputOptions {
  /**
   * Evaluator definitions to format.
   */
  evaluators: EvaluatorDefinition[];
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

/**
 * Format a list of shared evaluator definitions, one table row each.
 */
export function formatEvaluatorsOutput({
  evaluators,
  format,
}: FormatEvaluatorsOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(evaluators);
  }
  if (selected === "json") {
    return JSON.stringify(evaluators, null, 2);
  }
  if (evaluators.length === 0) {
    return "No evaluators found";
  }
  const rows = evaluators.map(evaluatorRow);
  // formatTable takes its headers from the first row, so every row carries every column.
  const columns = [
    ...BASE_COLUMNS,
    ...KIND_COLUMNS.filter((column) => rows.some((row) => column in row)),
  ];
  return formatTable(
    rows.map((row) =>
      Object.fromEntries(columns.map((column) => [column, row[column] ?? ""]))
    )
  );
}

const BASE_COLUMNS = ["name", "id", "type", "description"];
const KIND_COLUMNS = ["prompt version", "language", "version"];

function evaluatorRow(evaluator: EvaluatorDefinition): Record<string, unknown> {
  const row: Record<string, unknown> = {
    name: evaluator.name,
    id: evaluator.id,
    type: evaluator.type,
    description: evaluator.description ?? "",
  };
  switch (evaluator.type) {
    case "llm":
      row["prompt version"] = evaluator.prompt_version?.id ?? "";
      break;
    case "code":
      row.language = evaluator.language;
      row.version = evaluator.current_version_id ?? "";
      break;
    default:
      break;
  }
  return row;
}

export interface FormatEvaluatorVersionOutputOptions {
  /**
   * Code evaluator version to format. A version returned by `version create`
   * also carries `was_created`.
   */
  version: CodeEvaluatorVersion | CreatedCodeEvaluatorVersion;
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

/**
 * Format a code evaluator version. `pretty` omits the source, which can be
 * long; use `json` or `raw` to see it.
 */
export function formatEvaluatorVersionOutput({
  version,
  format,
}: FormatEvaluatorVersionOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(version);
  }
  if (selected === "json") {
    return JSON.stringify(version, null, 2);
  }
  const row = versionRow(version);
  if ("was_created" in version) {
    row.created = version.was_created ? "yes" : "no (source unchanged)";
  }
  return formatTable([row]);
}

export interface FormatEvaluatorVersionsOutputOptions {
  /**
   * Code evaluator versions to format, newest first.
   */
  versions: CodeEvaluatorVersion[];
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

/**
 * Format a list of code evaluator versions. `pretty` omits the source; use
 * `json` or `raw` to see it.
 */
export function formatEvaluatorVersionsOutput({
  versions,
  format,
}: FormatEvaluatorVersionsOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(versions);
  }
  if (selected === "json") {
    return JSON.stringify(versions, null, 2);
  }
  if (versions.length === 0) {
    return "No versions found";
  }
  return formatTable(versions.map(versionRow));
}

function versionRow(version: CodeEvaluatorVersion): Record<string, unknown> {
  return {
    "version id": version.id,
    "evaluator id": version.evaluator_id,
    "created at": version.created_at,
  };
}
