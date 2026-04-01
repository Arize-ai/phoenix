/**
 * Parse MIME part headers from a multipart message.
 *
 * Splits header text on newlines and extracts key-value pairs separated by `:`.
 * Header names are normalized to lowercase per HTTP convention.
 *
 * Derived from Apollo Client (MIT License).
 * @see https://github.com/apollographql/apollo-client/blob/main/src/link/http/parseAndCheckHttpResponse.ts
 * @see https://github.com/apollographql/apollo-client/blob/main/LICENSE
 */
export function parseMultipartHeaders(
  headerText: string
): Record<string, string> {
  const headers: Record<string, string> = {};
  headerText.split("\n").forEach((line) => {
    const i = line.indexOf(":");
    if (i > -1) {
      const name = line.slice(0, i).trim().toLowerCase();
      const value = line.slice(i + 1).trim();
      headers[name] = value;
    }
  });
  return headers;
}
