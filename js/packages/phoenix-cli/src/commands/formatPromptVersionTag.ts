import type { OutputFormat } from "./formatPrompts";

/**
 * The tag `px prompt tag` applied. Phoenix answers the tag request with
 * `204 No Content`, so this only echoes the request that succeeded — it does
 * not carry server-generated IDs, and it cannot say whether the tag was
 * created or moved from another version.
 */
export interface AppliedPromptVersionTag {
  /** The prompt version the tag now points to. */
  prompt_version_id: string;
  /** The prompt-scoped tag name. */
  name: string;
  /** The tag's description; `null` when none was sent, which clears it. */
  description: string | null;
}

export interface FormatPromptVersionTagOutputOptions {
  /** The tag that was applied. */
  tag: AppliedPromptVersionTag;
  /** Output format. Defaults to `"pretty"`. */
  format?: OutputFormat;
}

export function formatPromptVersionTagOutput({
  tag,
  format = "pretty",
}: FormatPromptVersionTagOutputOptions): string {
  if (format === "raw") {
    return JSON.stringify(tag);
  }
  if (format === "json") {
    return JSON.stringify(tag, null, 2);
  }
  return [
    "Tag applied",
    `  Tag: ${tag.name}`,
    `  Prompt version: ${tag.prompt_version_id}`,
    `  Description: ${tag.description ?? "(none)"}`,
  ].join("\n");
}
