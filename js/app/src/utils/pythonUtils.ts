/**
 * A function that converts it to a python friendly string
 */
function sanitizePythonStr(value: string) {
  // Escape backslashes FIRST before other escape sequences
  // Otherwise we would double-escape the backslashes we add for \n and \"
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll('"', '\\"');
}

/**
 * A function that converts a javascript primitive to a python primitive string
 * @param val - The value to convert
 * @returns The python primitive string
 */
export function toPythonPrimitiveStr(val: string | number | boolean): string {
  if (typeof val === "boolean") {
    return val ? "True" : "False";
  }
  if (typeof val === "number") {
    return val.toString();
  }
  if (typeof val === "string") {
    return `"${sanitizePythonStr(val)}"`;
  }
  return "";
}
