import type { componentsV1 } from "@arizeai/phoenix-client";

import type { OutputFormat } from "./formatEvaluator";
import { formatTable } from "./formatTable";

type SandboxConfig = componentsV1["schemas"]["SandboxConfig"];

export interface FormatSandboxConfigsOutputOptions {
  /**
   * Sandbox configurations to format.
   */
  configs: SandboxConfig[];
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

/**
 * Format sandbox configurations; `raw` and `json` keep every field.
 */
export function formatSandboxConfigsOutput({
  configs,
  format,
}: FormatSandboxConfigsOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(configs);
  }
  if (selected === "json") {
    return JSON.stringify(configs, null, 2);
  }
  if (configs.length === 0) {
    return "No sandbox configurations found";
  }
  return formatTable(
    configs.map((config) => ({
      name: config.name,
      id: config.id,
      language: config.language,
      backend: config.backend_type,
      usable: config.is_usable ? "yes" : "no",
    }))
  );
}
