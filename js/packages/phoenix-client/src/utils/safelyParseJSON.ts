/**
 * Safely parse a JSON string
 *
 * @param str - The string to parse
 * @returns An object containing both the parsed JSON and the error if there was one
 */
export function safelyParseJSON(str: string) {
  try {
    return { json: JSON.parse(str) };
  } catch (e) {
    return { json: null, parseError: e };
  }
}
