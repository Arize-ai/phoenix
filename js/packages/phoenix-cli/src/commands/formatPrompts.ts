import type { componentsV1 } from "@arizeai/phoenix-client";

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

  const lines: string[] = [];
  lines.push("Prompts:");
  lines.push("");

  for (const prompt of prompts) {
    const desc =
      prompt.description === null ||
      prompt.description === undefined ||
      prompt.description === ""
        ? ""
        : ` — ${prompt.description}`;

    lines.push(`┌─ ${prompt.name} (${prompt.id})`);
    if (desc) {
      lines.push(`│  Description:${desc}`);
    }
    if (prompt.metadata && Object.keys(prompt.metadata).length > 0) {
      lines.push(`│  Metadata: ${JSON.stringify(prompt.metadata)}`);
    }
    lines.push(`└─`);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
