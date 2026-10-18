import type { componentsV1 } from "@arizeai/phoenix-client";

import { formatTable } from "./formatTable";

export type OutputFormat = "pretty" | "json" | "raw";

type BuiltInModelProvider = componentsV1["schemas"]["BuiltInModelProvider"];

export interface FormatModelProvidersOutputOptions {
  /**
   * Model providers to format.
   */
  modelProviders: BuiltInModelProvider[];
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

export function formatModelProvidersOutput({
  modelProviders,
  format,
}: FormatModelProvidersOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(modelProviders);
  }
  if (selected === "json") {
    return JSON.stringify(modelProviders, null, 2);
  }
  if (modelProviders.length === 0) {
    return "No model providers found";
  }

  const rows = modelProviders.map((modelProvider) => ({
    provider: modelProvider.provider,
    name: modelProvider.name,
  }));

  return formatTable(rows);
}
