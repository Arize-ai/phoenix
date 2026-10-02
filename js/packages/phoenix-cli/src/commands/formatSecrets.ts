import type { componentsV1 } from "@arizeai/phoenix-client";

export type OutputFormat = "pretty" | "json" | "raw";

/**
 * The `PUT /v1/secrets` result: affected key names only. The server never
 * returns values, and neither does anything in this module.
 */
export type SecretsResult =
  componentsV1["schemas"]["UpsertOrDeleteSecretsResult"];

/**
 * Render one line naming the affected keys, or a "no-op" line when the list
 * is empty, e.g. `Upserted 2 secret(s): OPENAI_API_KEY, ANTHROPIC_API_KEY`.
 */
export function formatSecretKeysLine(verb: string, keys: string[]): string {
  if (keys.length === 0) {
    return `${verb} 0 secrets`;
  }
  return `${verb} ${keys.length} secret(s): ${keys.join(", ")}`;
}

/**
 * Format the result of `px secret set` for stdout. `pretty` is a one-line
 * summary per verb; `json`/`raw` echo the API result object so it can be
 * piped into `jq` (`.upserted_keys[]`).
 */
export function formatSecretsResultOutput({
  result,
  format,
}: {
  result: SecretsResult;
  format?: OutputFormat;
}): string {
  switch (format) {
    case "raw":
      return JSON.stringify(result);
    case "json":
      return JSON.stringify(result, null, 2);
    case "pretty":
    default: {
      const lines = [formatSecretKeysLine("Upserted", result.upserted_keys)];
      if (result.deleted_keys.length > 0) {
        lines.push(formatSecretKeysLine("Deleted", result.deleted_keys));
      }
      return lines.join("\n");
    }
  }
}
