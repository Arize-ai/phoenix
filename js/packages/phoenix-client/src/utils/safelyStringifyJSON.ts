/**
 * Safely stringify a JSON object
 *
 * @param args - The arguments to pass to JSON.stringify
 * @returns An object with the stringified JSON or an error if the stringification fails
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
