import { obscureApiKey } from "./commands/auth";

export interface RenderCurlCommandOptions {
  /** HTTP method for the request; upper-cased in the rendered `-X` flag. */
  method: string;
  /** Request URL, shell-escaped into the final line of the command. */
  url: string;
  /**
   * Request headers, rendered as one `-H` flag per entry. Duplicate header
   * names (case-insensitive, e.g. `authorization` and `Authorization`) are
   * combined the same way the platform `Headers` implementation combines
   * them, so the rendered command matches what `fetch` would actually send.
   */
  headers: Record<string, string>;
  /**
   * Request body, rendered as a single `--data-raw` flag. Omitted from the
   * output entirely when `undefined` (e.g. a bodyless GET).
   */
  body?: string;
  /**
   * When true, masks the value of the `Authorization` header with
   * `obscureApiKey` so the rendered command is safe to paste into logs, a
   * bug report, or chat. When false, the raw token is printed in the clear.
   */
  maskTokens: boolean;
}

function shellEscape(value: string): string {
  return "'" + value.replace(/'/g, "'\"'\"'") + "'";
}

/**
 * Normalize headers through the platform `Headers` implementation so curl
 * output mirrors how `fetch` combines duplicate logical headers such as
 * `authorization` + `Authorization`.
 */
function normalizeHeaders(
  headers: Record<string, string>
): Array<[string, string]> {
  const normalizedHeaders = new Headers();
  const headerNames = new Map<string, string>();

  for (const [key, value] of Object.entries(headers)) {
    normalizedHeaders.append(key, value);
    headerNames.set(
      key.toLowerCase(),
      headerNames.get(key.toLowerCase()) ?? key
    );
  }

  return Array.from(normalizedHeaders.entries()).map(([key, value]) => [
    headerNames.get(key) ?? key,
    value,
  ]);
}

function maskHeaderValue({
  key,
  value,
  maskTokens,
}: {
  key: string;
  value: string;
  maskTokens: boolean;
}): string {
  if (!maskTokens || key.toLowerCase() !== "authorization") {
    return value;
  }

  const match = value.match(/^(\S+)\s+(.+)$/);
  if (match) {
    const [, prefix, token] = match;
    return `${prefix} ${obscureApiKey(token)}`;
  }

  return obscureApiKey(value);
}

/**
 * Renders a pipe-friendly multiline curl command that matches the request
 * Phoenix CLI would send over `fetch`.
 */
export function renderCurlCommand({
  method,
  url,
  headers,
  body,
  maskTokens,
}: RenderCurlCommandOptions): string {
  const lines = ["curl \\"];

  lines.push(`  -X ${method.toUpperCase()} \\`);

  for (const [key, value] of normalizeHeaders(headers)) {
    lines.push(
      `  -H ${shellEscape(`${key}: ${maskHeaderValue({ key, value, maskTokens })}`)} \\`
    );
  }

  if (body !== undefined) {
    lines.push(`  --data-raw ${shellEscape(body)} \\`);
  }

  lines.push(`  ${shellEscape(url)}`);

  return lines.join("\n");
}
