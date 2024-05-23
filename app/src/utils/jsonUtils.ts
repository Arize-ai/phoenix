/**
 * Checks if a string is a valid JSON string.
 * @param {Object} options - The options object.
 * @param {string} options.str - The string to check.
 * @param {boolean} [options.excludeArray=false] - Whether to exclude arrays from the check.
 * @returns {boolean} - Returns true if the string is a valid JSON string, false otherwise.
 */
export function isJSONString({
  str,
  excludeArray = false,
}: {
  str: string;
  excludeArray?: boolean;
}) {
  if (typeof str !== "string") {
    return str;
  }
  try {
    const parsed = JSON.parse(str);
    if (excludeArray && Array.isArray(parsed)) {
      return false;
    }
  } catch (e) {
    return false;
  }
  return true;
}

export function isJSONObjectString(str: string) {
  return isJSONString({ str, excludeArray: true });
}
