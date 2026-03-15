import { obscureApiKey } from "./commands/auth";

export interface RenderCurlCommandOptions {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
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
