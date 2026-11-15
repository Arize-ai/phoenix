export type OutputFormat = "pretty" | "json" | "raw";

export interface PromptVersionTagDeleteResult {
  deleted: true;
  prompt_version_id: string;
  tag_name: string;
}

export interface FormatPromptVersionTagDeleteOutputOptions {
  result: PromptVersionTagDeleteResult;
  format?: OutputFormat;
}

/**
 * Format the structured success record returned by `px prompt untag`.
 *
 * The delete endpoint returns no body, so the record echoes the prompt version
 * and tag that were removed for downstream callers and audit trails.
 */
export function formatPromptVersionTagDeleteOutput({
  result,
  format,
}: FormatPromptVersionTagDeleteOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(result);
  }
  if (selected === "json") {
    return JSON.stringify(result, null, 2);
  }
  return `Deleted tag "${result.tag_name}" from prompt version ${result.prompt_version_id}.`;
}
