import type { componentsV1 } from "@arizeai/phoenix-client";

import { formatTable } from "./formatTable";

export type OutputFormat = "pretty" | "json" | "raw";

type Prompt = componentsV1["schemas"]["Prompt"];

export interface FormatPromptsOutputOptions {
  /**
   * Prompts to format.
   */
  prompts: Prompt[];
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

export function formatPromptsOutput({
  prompts,
  format,
}: FormatPromptsOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(prompts);
  }
  if (selected === "json") {
    return JSON.stringify(prompts, null, 2);
  }
  return formatPromptsPretty(prompts);
}

function formatPromptsPretty(prompts: Prompt[]): string {
  if (prompts.length === 0) {
    return "No prompts found";
  }

  const rows = prompts.map((p) => ({
    name: p.name,
    id: p.id,
    description: p.description ?? "",
  }));

  return formatTable(rows);
}
