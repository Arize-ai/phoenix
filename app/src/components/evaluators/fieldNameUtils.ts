/**
 * Utilities for handling field names that contain dots when used with react-hook-form.
 *
 * react-hook-form interprets dots in field names as nested object paths. For example,
 * `pathMapping.output.available_tools` is interpreted as:
 *   { pathMapping: { output: { available_tools: "value" } } }
 *
 * But we want to use keys that literally contain dots:
 *   { pathMapping: { "output.available_tools": "value" } }
 *
 * These utilities escape dots in field names so that react-hook-form treats them
 * as literal characters rather than path separators.
 *
 * We use a URL-encoding style escape scheme to handle edge cases where the escape
 * sequence itself might appear in the original field name:
 * - `.` is escaped as `%2E`
 * - `%` is escaped as `%25` (to prevent conflicts with the escape sequence)
 */

/**
 * Escapes dots in a field name so react-hook-form treats them as literal characters.
 * Use this when constructing field names for react-hook-form's Controller or setValue.
 *
 * Uses URL-encoding style escaping to handle edge cases:
 * - First escapes `%` to `%25` (so existing `%2E` becomes `%252E`)
 * - Then escapes `.` to `%2E`
 *
 * @example
 * escapeFieldNameForReactHookForm("output.available_tools")
 * // => "output%2Eavailable_tools"
 *
 * @example
 * // Edge case: literal %2E in field name is preserved
 * escapeFieldNameForReactHookForm("foo%2Ebar")
 * // => "foo%252Ebar"
 */
export function escapeFieldNameForReactHookForm(fieldName: string): string {
  // Order matters: escape % first, then .
  return fieldName.replace(/%/g, "%25").replace(/\./g, "%2E");
}

/**
 * Unescapes a field name that was escaped with escapeFieldNameForReactHookForm.
 * Use this when reading values from form state to get back the original key name.
 *
 * @example
 * unescapeFieldNameFromReactHookForm("output%2Eavailable_tools")
 * // => "output.available_tools"
 *
 * @example
 * // Edge case: escaped %2E is restored correctly
 * unescapeFieldNameFromReactHookForm("foo%252Ebar")
 * // => "foo%2Ebar"
 */
export function unescapeFieldNameFromReactHookForm(fieldName: string): string {
  // Order matters: unescape . first, then %
  return fieldName.replace(/%2E/g, ".").replace(/%25/g, "%");
}
