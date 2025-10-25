import { HeadersOptions } from "openapi-fetch";

/**
 * A utility function that simplifies the headers for passing to other clients
 */
export function toObjectHeaders(
  headers: HeadersOptions
): Record<string, string> {
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  const objectHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value !== null && value !== undefined) {
      objectHeaders[key] = Array.isArray(value)
        ? value.join(", ")
        : String(value);
    }
  }
  return objectHeaders;
}
