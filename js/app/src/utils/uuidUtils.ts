/**
 * Generates a RFC 4122 version 4 UUID.
 *
 * Works in both secure (HTTPS) and non-secure (HTTP) browser contexts,
 * making it safe for use in Docker deployments served over plain HTTP.
 *
 * @returns A lowercase UUID v4 string, e.g. "110e8400-e29b-41d4-a716-446655440000"
 */
export function generateUUID(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // crypto.randomUUID is unavailable in non-secure (HTTP) contexts.
  // crypto.getRandomValues is available in all contexts, including HTTP.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
