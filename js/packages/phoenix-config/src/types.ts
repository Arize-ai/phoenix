export type Headers = Record<string, string>;

export function isHeaders(value: unknown): value is Headers {
  const isObject =
    typeof value === "object" && value !== null && !Array.isArray(value);
  if (!isObject) {
    return false;
  }
  return Object.values(value).every((value) => typeof value === "string");
}
