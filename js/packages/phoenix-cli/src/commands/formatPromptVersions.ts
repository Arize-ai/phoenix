import type { componentsV1 } from "@arizeai/phoenix-client";

import type { OutputFormat } from "./formatPrompts";
import { formatTable } from "./formatTable";

// Older Phoenix servers do not include the creation timestamp.
export type PromptVersion = Omit<
  componentsV1["schemas"]["PromptVersion"],
  "created_at"
> & { created_at?: string };

export interface FormatPromptVersionsOutputOptions {
  /** Prompt versions to format, in server order. */
  promptVersions: PromptVersion[];
  /** Output format. Defaults to `"pretty"`. */
  format?: OutputFormat;
}

export function formatPromptVersionsOutput({
  promptVersions,
  format = "pretty",
}: FormatPromptVersionsOutputOptions): string {
  if (format === "raw") {
    return JSON.stringify(promptVersions);
  }
  if (format === "json") {
    return JSON.stringify(promptVersions, null, 2);
  }
  if (promptVersions.length === 0) {
    return "No prompt versions found";
  }
  return formatTable(
    promptVersions.map((promptVersion) => ({
      id: promptVersion.id,
      description: promptVersion.description ?? "",
      model_provider: promptVersion.model_provider,
      model_name: promptVersion.model_name,
      created_at: promptVersion.created_at ?? "",
    }))
  );
}
