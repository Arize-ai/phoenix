/**
 * A function that converts it to a python friendly string
 */
function sanitizePythonStr(value: string) {
  return value.replaceAll("\n", "\\n").replaceAll('"', '\\"');
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
