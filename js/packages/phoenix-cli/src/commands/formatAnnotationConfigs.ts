import type { componentsV1 } from "@arizeai/phoenix-client";

import { formatTable } from "./formatTable";

export type OutputFormat = "pretty" | "json" | "raw";

type AnnotationConfig =
  | componentsV1["schemas"]["CategoricalAnnotationConfig"]
  | componentsV1["schemas"]["ContinuousAnnotationConfig"]
  | componentsV1["schemas"]["FreeformAnnotationConfig"];

export interface FormatAnnotationConfigsOutputOptions {
  /**
   * Annotation configs to format.
   */
  configs: AnnotationConfig[];
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

export function formatAnnotationConfigsOutput({
  configs,
  format,
}: FormatAnnotationConfigsOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(configs);
  }
  if (selected === "json") {
    return JSON.stringify(configs, null, 2);
  }
  return formatAnnotationConfigsPretty(configs);
}

export interface FormatAnnotationConfigOutputOptions {
  /**
   * Annotation config to format.
   */
  config: AnnotationConfig;
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

/**
 * Format a single annotation config. `raw`/`json` emit the config object
 * directly (not wrapped in an array) so agents can extract fields such as
 * `.id` without indexing. `pretty` renders the shared single-row table.
 */
export function formatAnnotationConfigOutput({
  config,
  format,
}: FormatAnnotationConfigOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(config);
  }
  if (selected === "json") {
    return JSON.stringify(config, null, 2);
  }
  return formatAnnotationConfigsPretty([config]);
}

function formatAnnotationConfigsPretty(configs: AnnotationConfig[]): string {
  if (configs.length === 0) {
    return "No annotation configs found";
  }

  const rows = configs.map((c) => ({
    name: c.name,
    id: c.id,
    type: c.type,
    description: c.description ?? "",
  }));

  return formatTable(rows);
}
