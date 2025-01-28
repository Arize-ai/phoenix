/**
 * Safely stringify a JSON object
 *
 * @param args - The arguments to pass to JSON.stringify
 * @returns An object containing both the stringified JSON and the error if there was one
 */
export function safelyStringifyJSON(
  ...args: Parameters<typeof JSON.stringify>
) {
  try {
    return { json: JSON.stringify(...args) };
  } catch (e) {
    return { json: null, stringifyError: e };
  }
}
